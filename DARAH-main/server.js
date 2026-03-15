"use strict";

/**
 * DARAH backend API
 * Serves homepage, products, cart and WhatsApp checkout.
 * Also serves the client app with resilient paths for Railway.
 */

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const compression = require("compression");
const http = require("http");

// Database persistence helpers
const {
  initDatabase,
  persistHomepage,
  persistProductUpsert,
  persistProductDelete
} = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// Limits
const MAX_HOMEPAGE_IMAGES = 12;
const MAX_ABOUT_IMAGES = 4;
const MAX_PRODUCT_IMAGES = 5;

// Allow reasonably sized compressed data URLs and normal URLs.
// Admin panel should already compress. This is just a guard so the API
// does not accidentally store massive external URLs.
const MAX_IMAGE_URL_LENGTH = 900000;

// If true, storefront will include products even when stock is 0.
// This is the most common reason "missing products" happen.
const SHOW_OUT_OF_STOCK_PRODUCTS = true;

/* ------------------------------------------------------------------ */
/* Resolve client directory robustly                                   */
/* ------------------------------------------------------------------ */
function resolveClientDir() {
  const fromEnv = process.env.STATIC_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  const candidates = [
    path.resolve(__dirname, "..", "client"),
    path.resolve(__dirname, "client"),
    path.resolve(process.cwd(), "client")
  ];

  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "index.html"))) return p;
  }
  return candidates[0];
}

const CLIENT_DIR = resolveClientDir();
const INDEX_HTML = path.join(CLIENT_DIR, "index.html");
const ADMIN_HTML = path.join(CLIENT_DIR, "admin.html");

// Compute these once to avoid repeated sync filesystem checks on every request
const INDEX_EXISTS = fs.existsSync(INDEX_HTML);
const ADMIN_EXISTS = fs.existsSync(ADMIN_HTML);

// Read index.html once into memory so we can inject bootstrap data quickly
let INDEX_HTML_TEMPLATE = null;
if (INDEX_EXISTS) {
  try {
    INDEX_HTML_TEMPLATE = fs.readFileSync(INDEX_HTML, "utf8");
  } catch (err) {
    console.error("[DARAH] Failed to read index.html template:", err);
    INDEX_HTML_TEMPLATE = null;
  }
}

// Cached HTML with bootstrap so we do not rebuild on every request
let cachedIndexHtml = null;
let cachedIndexVersionKey = "";

console.log("[DARAH] Serving static files from:", CLIENT_DIR);
if (!INDEX_EXISTS) {
  console.warn("[DARAH] Warning: index.html not found at", INDEX_HTML);
}
if (!ADMIN_EXISTS) {
  console.warn("[DARAH] Warning: admin.html not found at", ADMIN_HTML);
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

// Trust proxies so Railway or other platforms can handle HTTPS correctly
app.set("trust proxy", 1);

// Increase limit so multiple mobile photos do not break the request
app.use(express.json({ limit: "50mb" }));

// Enable gzip compression for JSON and other text responses
app.use(
  compression({
    threshold: 1024
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "darah-dev-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Cache settings for API: default no store so admin changes reflect instantly.
// Public read endpoints like /api/homepage and /api/products will override
// this header with their own Cache Control.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Static client assets with strong caching for CSS, JS, images.
// BUT: main.js and styles.css must not be cached long term because they are not fingerprinted.
app.use(
  express.static(CLIENT_DIR, {
    fallthrough: true,
    index: false,
    etag: true,
    setHeaders(res, filePath) {
      const base = path.basename(filePath).toLowerCase();

      if (filePath.match(/\.html$/i)) {
        res.setHeader("Cache-Control", "no-store");
        return;
      }

      if (base === "main.js" || base === "styles.css") {
        res.setHeader("Cache-Control", "no-store");
        return;
      }

      if (filePath.match(/\.(js|css|png|jpe?g|webp|svg)$/i)) {
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      }
    }
  })
);

/* ------------------------------------------------------------------ */
/* In memory data (hydrated from DB at startup if DATABASE_URL set)    */
/* ------------------------------------------------------------------ */
const db = {
  homepage: {
    aboutText:
      "DARAH é uma joalheria dedicada a peças elegantes e atemporais, criadas para acompanhar você em todos os momentos especiais.",
    aboutLongText: "",
    heroImages: [],
    notices: [],
    theme: "default",
    aboutImages: []
  },
  products: []
};

// Simple dedup guard for very fast double submits of the same product
let lastProductCreate = {
  fingerprint: "",
  at: 0,
  id: null
};

// Simple cache for grouped public products to avoid recomputing on every request
let productsVersion = 0;
let productsCache = {
  version: 0,
  data: null
};

// Version for homepage so we can cache index.html per content version
let homepageVersion = 0;

function bumpProductsVersion() {
  productsVersion += 1;
  if (productsVersion > Number.MAX_SAFE_INTEGER - 1) {
    productsVersion = 1;
  }
  productsCache = {
    version: 0,
    data: null
  };
}

// Prebuilt BRL formatter for slightly faster repeated formatting
let BRL_FORMATTER = null;
try {
  BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
} catch {
  BRL_FORMATTER = null;
}

function brl(n) {
  const value = Number(n || 0);
  try {
    if (BRL_FORMATTER) {
      return BRL_FORMATTER.format(value);
    }
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  } catch {
    return "R$ " + value.toFixed(2).replace(".", ",");
  }
}

function ensureSessionCart(req) {
  if (!req.session.cart) req.session.cart = { items: [] };
  return req.session.cart;
}

function normalizeImageArray(arr, limit) {
  const max =
    typeof limit === "number" && limit > 0 ? limit : MAX_PRODUCT_IMAGES;

  if (!Array.isArray(arr)) return [];

  const cleaned = arr
    .map((s) => String(s || "").trim())
    .filter((s, idx, a) => {
      if (!s) return false;

      // Drop duplicates
      if (a.indexOf(s) !== idx) return false;

      // Only enforce size guard for non data URLs.
      if (!s.startsWith("data:image") && s.length > MAX_IMAGE_URL_LENGTH) {
        return false;
      }

      return true;
    });

  return cleaned.slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Category normalization (very common source of "missing products")   */
/* ------------------------------------------------------------------ */

const ALLOWED_CATEGORIES = [
  "specials",
  "sets",
  "rings",
  "necklaces",
  "bracelets",
  "earrings"
];

function normalizeCategory(raw) {
  const s = String(raw || "").trim().toLowerCase();

  if (!s) return "";

  // Common older or alternate forms
  const map = {
    special: "specials",
    specials: "specials",
    oferta: "specials",
    ofertas: "specials",

    set: "sets",
    sets: "sets",
    conjunto: "sets",
    conjuntos: "sets",

    ring: "rings",
    rings: "rings",
    anel: "rings",
    aneis: "rings",
    anéis: "rings",

    necklace: "necklaces",
    necklaces: "necklaces",
    colar: "necklaces",
    colares: "necklaces",

    bracelet: "bracelets",
    bracelets: "bracelets",
    pulseira: "bracelets",
    pulseiras: "bracelets",

    earring: "earrings",
    earrings: "earrings",
    brinco: "earrings",
    brincos: "earrings"
  };

  const mapped = map[s] || s;
  if (ALLOWED_CATEGORIES.includes(mapped)) return mapped;

  return "";
}

function groupPublicProducts() {
  if (productsCache.data && productsCache.version === productsVersion) {
    return productsCache.data;
  }

  const out = {
    specials: [],
    sets: [],
    rings: [],
    necklaces: [],
    bracelets: [],
    earrings: []
  };

  db.products.forEach((p) => {
    if (!p) return;

    // Normalize category so legacy values still show
    const cat = normalizeCategory(p.category);
    if (!cat || !out[cat]) return;

    // Keep respecting active flag
    if (p.active === false) return;

    // Previously you filtered out stock <= 0. That causes "missing products".
    const stockNum = typeof p.stock === "number" ? p.stock : Number(p.stock || 0);
    const stock = Number.isNaN(stockNum) ? 0 : stockNum;

    if (!SHOW_OUT_OF_STOCK_PRODUCTS && stock <= 0) return;

    const imageUrls = normalizeImageArray(p.imageUrls || [], MAX_PRODUCT_IMAGES);
    const imageUrl = p.imageUrl || imageUrls[0] || "";

    out[cat].push({
      id: p.id,
      createdAt: p.createdAt,
      category: cat,
      name: p.name,
      description: p.description,
      price: Number(p.price || 0),
      stock,
      active: p.active !== false,
      imageUrl,
      imageUrls,
      images: imageUrls.slice(),
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
      discountLabel: typeof p.discountLabel === "string" ? p.discountLabel : ""
    });
  });

  productsCache = {
    version: productsVersion,
    data: out
  };

  return out;
}

function summarizeCart(cart) {
  if (!cart || !Array.isArray(cart.items)) {
    return { items: [], subtotal: 0, taxes: 0, total: 0 };
  }

  const items = cart.items
    .map((it) => {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) return null;

      const rawQuantity = Number(it.quantity || 0);
      const stockNum = typeof product.stock === "number" ? product.stock : Number(product.stock || 0);
      const maxStock = Number.isNaN(stockNum) ? 0 : Math.max(0, stockNum);

      const quantity = Math.max(0, Math.min(rawQuantity, maxStock));
      if (!quantity) return null;

      const price = Number(product.price || 0);
      const lineTotal = quantity * price;

      return {
        id: product.id,
        name: product.name,
        price,
        quantity,
        lineTotal,
        imageUrl: product.imageUrl || ""
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const taxes = 0;
  const total = subtotal + taxes;
  return { items, subtotal, taxes, total };
}

const newId = () => crypto.randomBytes(8).toString("hex");

/* ------------------------------------------------------------------ */
/* Helpers for public homepage and HTTP caching                        */
/* ------------------------------------------------------------------ */

function buildPublicHomepagePayload() {
  const heroImages = normalizeImageArray(
    db.homepage.heroImages || [],
    MAX_HOMEPAGE_IMAGES
  );

  const aboutImages = normalizeImageArray(
    db.homepage.aboutImages || [],
    MAX_ABOUT_IMAGES
  );

  const notices = Array.isArray(db.homepage.notices)
    ? db.homepage.notices
        .map((n) => String(n || "").trim())
        .filter((n, idx, a) => n && a.indexOf(n) === idx)
        .slice(0, 10)
    : [];

  return {
    aboutText: db.homepage.aboutText || "",
    aboutLongText: db.homepage.aboutLongText || "",
    heroImages,
    aboutImages,
    notices,
    theme: typeof db.homepage.theme === "string" ? db.homepage.theme : "default"
  };
}

function sendJsonWithEtag(req, res, payload, cacheKey) {
  const body = JSON.stringify(payload);
  const hash = crypto.createHash("sha1").update(body).digest("hex").slice(0, 16);
  const etag = `"${cacheKey}-${hash}"`;

  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("ETag", etag);

  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
    return res.status(304).end();
  }

  res.type("application/json");
  return res.send(body);
}

function renderIndexWithBootstrap() {
  if (!INDEX_HTML_TEMPLATE) return null;

  const versionKey = `${homepageVersion}:${productsVersion}`;

  if (cachedIndexHtml && cachedIndexVersionKey === versionKey) {
    return cachedIndexHtml;
  }

  // Build lightweight bootstrap WITHOUT images to keep HTML small and fast
  const homepage = buildPublicHomepagePayload();
  const products = groupPublicProducts();

  // Strip images from bootstrap - they'll load async for speed
  const lightweightHomepage = {
    aboutText: homepage.aboutText,
    aboutLongText: homepage.aboutLongText,
    notices: homepage.notices,
    theme: homepage.theme,
    // Images excluded - will load via API
    heroImages: [],
    aboutImages: []
  };

  // Strip images from products - keep structure light
  const lightweightProducts = {};
  Object.keys(products).forEach(cat => {
    lightweightProducts[cat] = products[cat].map(p => ({
      id: p.id,
      category: p.category,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      active: p.active,
      originalPrice: p.originalPrice,
      discountLabel: p.discountLabel,
      // Images excluded - will load on demand
      imageUrl: "",
      imageUrls: [],
      images: []
    }));
  });

  const bootstrap = {
    homepage: lightweightHomepage,
    products: lightweightProducts,
    productsVersion,
    // Flag to indicate images need to be loaded
    imagesDeferred: true
  };

  const json = JSON.stringify(bootstrap).replace(/</g, "\\u003c");

  const scriptTag =
    `<script>` +
    `window.__DARAH_BOOTSTRAP__ = ${json};` +
    `</script>`;

  let html = INDEX_HTML_TEMPLATE;
  // Inject in head for immediate availability
  if (html.includes("</head>")) {
    html = html.replace("</head>", scriptTag + "</head>");
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", scriptTag + "</body>");
  } else {
    html += scriptTag;
  }

  cachedIndexHtml = html;
  cachedIndexVersionKey = versionKey;
  return html;
}

/* ------------------------------------------------------------------ */
/* Admin authentication                                                */
/* ------------------------------------------------------------------ */

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Não autorizado." });
}

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true, welcome: "Bem vinda, Danielle!" });
  }
  return res.status(401).json({ error: "Usuário ou senha inválidos." });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Debug counts so we can see why products are missing
app.get("/api/admin/debug/products", requireAdmin, (_req, res) => {
  const total = db.products.length;

  const byCategory = {};
  const categoryInvalid = [];

  let inactiveCount = 0;
  let outOfStockCount = 0;

  for (const p of db.products) {
    const cat = normalizeCategory(p?.category);
    if (!cat) {
      categoryInvalid.push({ id: p?.id, category: p?.category });
    } else {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    if (p?.active === false) inactiveCount += 1;

    const stockNum = typeof p?.stock === "number" ? p.stock : Number(p?.stock || 0);
    const stock = Number.isNaN(stockNum) ? 0 : stockNum;
    if (stock <= 0) outOfStockCount += 1;
  }

  res.json({
    totalProductsLoaded: total,
    inactiveCount,
    outOfStockCount,
    byCategory,
    invalidCategorySamples: categoryInvalid.slice(0, 25),
    showOutOfStockOnStorefront: SHOW_OUT_OF_STOCK_PRODUCTS
  });
});

// Homepage
app.get("/api/homepage", (req, res) => {
  const payload = buildPublicHomepagePayload();
  return sendJsonWithEtag(req, res, payload, "homepage");
});

app.put("/api/homepage", requireAdmin, async (req, res) => {
  const { aboutText, aboutLongText, heroImages, aboutImages, notices, theme } =
    req.body || {};

  if (typeof aboutText === "string") {
    db.homepage.aboutText = aboutText;
  }

  if (typeof aboutLongText === "string") {
    db.homepage.aboutLongText = aboutLongText;
  }

  if (Array.isArray(heroImages)) {
    db.homepage.heroImages = normalizeImageArray(heroImages, MAX_HOMEPAGE_IMAGES);
  }

  if (Array.isArray(aboutImages)) {
    db.homepage.aboutImages = normalizeImageArray(aboutImages, MAX_ABOUT_IMAGES);
  }

  if (Array.isArray(notices)) {
    db.homepage.notices = notices
      .map((n) => String(n || "").trim())
      .filter((n, idx, a) => n && a.indexOf(n) === idx)
      .slice(0, 10);
  }

  if (typeof theme === "string") {
    const trimmed = theme.trim();
    db.homepage.theme = trimmed || "default";
  }

  homepageVersion += 1;
  cachedIndexHtml = null;
  cachedIndexVersionKey = "";

  try {
    await persistHomepage(db.homepage);
    res.json({ ok: true });
  } catch (err) {
    console.error("[homepage] Error persisting homepage to DB:", err);
    res.status(500).json({ error: "Erro ao salvar homepage." });
  }
});

// Products
app.get("/api/products", (req, res) => {
  const grouped = groupPublicProducts();
  return sendJsonWithEtag(req, res, grouped, "products");
});

app.get("/api/admin/products", requireAdmin, (_req, res) => {
  // Admin should show everything, even inactive and stock 0.
  const adminProducts = db.products.map((p) => {
    const imageUrls = normalizeImageArray(p.imageUrls || [], MAX_PRODUCT_IMAGES);
    const imageUrl = p.imageUrl || imageUrls[0] || "";
    return {
      ...p,
      category: normalizeCategory(p.category) || p.category,
      imageUrl,
      imageUrls,
      images: imageUrls.slice()
    };
  });
  res.json(adminProducts);
});

app.post("/api/products", requireAdmin, async (req, res) => {
  const {
    category,
    name,
    description,
    price,
    stock,
    imageUrl,
    imageUrls,
    images,
    originalPrice,
    discountLabel
  } = req.body || {};

  if (!name || typeof price !== "number" || typeof stock !== "number") {
    return res
      .status(400)
      .json({ error: "Preencha pelo menos nome, preço e estoque." });
  }

  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    return res.status(400).json({ error: "Categoria inválida." });
  }

  const rawImages = Array.isArray(imageUrls)
    ? imageUrls
    : Array.isArray(images)
    ? images
    : [];

  const normalizedImages = normalizeImageArray(rawImages, MAX_PRODUCT_IMAGES);
  const primaryImageUrl = String(imageUrl || normalizedImages[0] || "");

  const normalizedOriginalPrice =
    typeof originalPrice === "number" && !Number.isNaN(originalPrice)
      ? Number(originalPrice)
      : null;

  const normalizedDiscountLabel =
    typeof discountLabel === "string" && discountLabel.trim().length
      ? discountLabel.trim()
      : "";

  const normalizedPayload = {
    category: normalizedCategory,
    name: String(name),
    description: String(description || ""),
    price: Number(price),
    stock: Math.max(0, Number(stock)),
    imageUrl: primaryImageUrl,
    imageUrls: normalizedImages,
    originalPrice: normalizedOriginalPrice,
    discountLabel: normalizedDiscountLabel
  };

  const fingerprint = JSON.stringify(normalizedPayload);
  const now = Date.now();
  if (
    lastProductCreate.fingerprint === fingerprint &&
    now - lastProductCreate.at < 2000 &&
    lastProductCreate.id
  ) {
    return res.json({ ok: true, id: lastProductCreate.id, deduplicated: true });
  }

  const product = {
    id: newId(),
    createdAt: new Date().toISOString(),
    category: normalizedPayload.category,
    name: normalizedPayload.name,
    description: normalizedPayload.description,
    price: normalizedPayload.price,
    stock: normalizedPayload.stock,
    active: true,
    imageUrl: normalizedPayload.imageUrl,
    imageUrls: normalizedPayload.imageUrls,
    originalPrice: normalizedPayload.originalPrice,
    discountLabel: normalizedPayload.discountLabel
  };

  db.products.push(product);
  bumpProductsVersion();
  cachedIndexHtml = null;
  cachedIndexVersionKey = "";

  lastProductCreate = {
    fingerprint,
    at: now,
    id: product.id
  };

  try {
    await persistProductUpsert(product);
    res.json({ ok: true, id: product.id });
  } catch (err) {
    console.error("[products] Error persisting new product to DB:", err);
    res.status(500).json({ error: "Erro ao salvar produto." });
  }
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Produto não encontrado." });

  if (Array.isArray(req.body?.images) && !req.body.imageUrls) {
    req.body.imageUrls = req.body.images;
  }

  const allowed = [
    "category",
    "name",
    "description",
    "price",
    "stock",
    "imageUrl",
    "imageUrls",
    "active",
    "originalPrice",
    "discountLabel"
  ];

  for (const k of Object.keys(req.body || {})) {
    if (!allowed.includes(k)) continue;

    if (k === "stock") {
      product.stock = Math.max(0, Number(req.body[k]));
      continue;
    }

    if (k === "price") {
      product.price = Number(req.body[k]);
      continue;
    }

    if (k === "category") {
      const cat = normalizeCategory(req.body[k]);
      if (!cat) {
        return res.status(400).json({ error: "Categoria inválida." });
      }
      product.category = cat;
      continue;
    }

    if (k === "imageUrls") {
      const srcs = Array.isArray(req.body[k]) ? req.body[k] : [];
      const cleaned = normalizeImageArray(srcs, MAX_PRODUCT_IMAGES);
      product.imageUrls = cleaned;
      if (!product.imageUrl && cleaned.length) {
        product.imageUrl = cleaned[0];
      }
      continue;
    }

    if (k === "originalPrice") {
      const v = req.body[k];
      if (typeof v === "number" && !Number.isNaN(v)) {
        product.originalPrice = Number(v);
      } else if (v == null || v === "") {
        product.originalPrice = null;
      }
      continue;
    }

    if (k === "discountLabel") {
      product.discountLabel = String(req.body[k] || "").trim();
      continue;
    }

    if (k === "imageUrl") {
      product.imageUrl = String(req.body[k] || "");
      continue;
    }

    product[k] = req.body[k];
  }

  bumpProductsVersion();
  cachedIndexHtml = null;
  cachedIndexVersionKey = "";

  try {
    await persistProductUpsert(product);
    res.json({ ok: true });
  } catch (err) {
    console.error("[products] Error updating product in DB:", err);
    res.status(500).json({ error: "Erro ao atualizar produto." });
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Produto não encontrado." });

  const productId = db.products[idx].id;
  db.products.splice(idx, 1);
  bumpProductsVersion();
  cachedIndexHtml = null;
  cachedIndexVersionKey = "";

  try {
    await persistProductDelete(productId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[products] Error deleting product from DB:", err);
    res.status(500).json({ error: "Erro ao excluir produto." });
  }
});

// Batch compress product images (called by admin save buttons)
app.post("/api/admin/compress-images", requireAdmin, async (req, res) => {
  const { products } = req.body || {};

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "Payload inválido." });
  }

  let updated = 0;
  for (const update of products) {
    if (!update || !update.id) continue;

    const product = db.products.find((p) => p.id === update.id);
    if (!product) continue;

    const imageUrls = normalizeImageArray(update.imageUrls || [], MAX_PRODUCT_IMAGES);
    const imageUrl = String(update.imageUrl || imageUrls[0] || "");

    product.imageUrl = imageUrl;
    product.imageUrls = imageUrls;

    try {
      await persistProductUpsert(product);
      updated++;
    } catch (err) {
      console.error("[compress] Error persisting product:", err);
    }
  }

  if (updated > 0) {
    bumpProductsVersion();
    cachedIndexHtml = null;
    cachedIndexVersionKey = "";
  }

  res.json({ ok: true, updated });
});

// Cart
app.get("/api/cart", (req, res) =>
  res.json(summarizeCart(ensureSessionCart(req)))
);

app.post("/api/cart/add", (req, res) => {
  const { productId } = req.body || {};
  const product = db.products.find((p) => p.id === productId && p.active !== false);
  if (!product) return res.status(404).json({ error: "Produto não encontrado." });

  const stockNum = typeof product.stock === "number" ? product.stock : Number(product.stock || 0);
  const stock = Number.isNaN(stockNum) ? 0 : stockNum;

  if (!stock || stock <= 0) {
    return res.status(400).json({ error: "Produto sem estoque." });
  }

  const cart = ensureSessionCart(req);
  const item = cart.items.find((it) => it.productId === productId);

  if (item) {
    const next = item.quantity + 1;
    if (next > stock) {
      return res
        .status(400)
        .json({ error: "Quantidade além do estoque disponível." });
    }
    item.quantity = next;
  } else {
    cart.items.push({ productId, quantity: 1 });
  }

  res.json(summarizeCart(cart));
});

app.post("/api/cart/update", (req, res) => {
  const { productId, quantity } = req.body || {};
  const product = db.products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: "Produto não encontrado." });

  const cart = ensureSessionCart(req);
  const item = cart.items.find((it) => it.productId === productId);
  if (!item) return res.status(404).json({ error: "Item não está no carrinho." });

  const q = Number(quantity);
  if (Number.isNaN(q) || q < 0) {
    return res.status(400).json({ error: "Quantidade inválida." });
  }

  const stockNum = typeof product.stock === "number" ? product.stock : Number(product.stock || 0);
  const stock = Number.isNaN(stockNum) ? 0 : stockNum;

  if (q === 0) {
    cart.items = cart.items.filter((it) => it.productId !== productId);
  } else if (q > stock) {
    return res.status(400).json({ error: "Quantidade além do estoque disponível." });
  } else {
    item.quantity = q;
  }

  res.json(summarizeCart(cart));
});

// WhatsApp checkout
app.post("/api/checkout-link", (req, res) => {
  // Accept cart items from request body (sent from client localStorage)
  const { items } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Carrinho vazio." });
  }

  // Build WhatsApp message
  const lines = [];
  lines.push("Olá, eu gostaria de fazer um pedido dos seguintes itens:");
  lines.push("");

  let total = 0;
  items.forEach((item, i) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    const lineTotal = price * quantity;
    total += lineTotal;

    const itemLine = `${i + 1}. ${item.name}`;
    const priceLine = `   ${quantity} x ${brl(price)} = ${brl(lineTotal)}`;
    lines.push(itemLine);
    lines.push(priceLine);
  });

  lines.push("");
  lines.push(`*Total: ${brl(total)}*`);

  const phone = "5565999883400";
  const text = encodeURIComponent(lines.join("\n"));
  res.json({ url: `https://wa.me/${phone}?text=${text}` });
});

/* ------------------------------------------------------------------ */
/* Sitemap (excludes admin)                                            */
/* ------------------------------------------------------------------ */

app.get("/robots.txt", (req, res) => {
  const protocol = req.protocol;
  const host = req.get("host");
  const base = process.env.SITE_URL || `${protocol}://${host}`;

  const txt = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /admin.html",
    "Disallow: /api/",
    "",
    `Sitemap: ${base}/sitemap.xml`
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(txt);
});

app.get("/sitemap.xml", (req, res) => {
  const protocol = req.protocol;
  const host = req.get("host");
  const base = process.env.SITE_URL || `${protocol}://${host}`;

  const publicPaths = [
    { loc: "/", priority: "1.0" },
    { loc: "/#sobre-nos", priority: "0.8" },
    { loc: "/#ofertas-especiais", priority: "0.7" },
    { loc: "/#conjuntos", priority: "0.7" },
    { loc: "/#aneis", priority: "0.7" },
    { loc: "/#colares", priority: "0.7" },
    { loc: "/#pulseiras", priority: "0.7" },
    { loc: "/#brincos", priority: "0.7" }
  ];

  const today = new Date().toISOString().split("T")[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of publicPaths) {
    xml += "  <url>\n";
    xml += `    <loc>${base}${p.loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <priority>${p.priority}</priority>\n`;
    xml += "  </url>\n";
  }

  xml += "</urlset>\n";

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

/* ------------------------------------------------------------------ */
/* Client routes and fallback                                          */
/* ------------------------------------------------------------------ */

function sendHtmlWithNoCache(res, filePath) {
  res.setHeader("Cache-Control", "no-store");
  return res.sendFile(filePath);
}

app.get("/admin", (_req, res) => {
  if (ADMIN_EXISTS) return sendHtmlWithNoCache(res, ADMIN_HTML);
  return res.redirect("/admin.html");
});

app.get("/", (_req, res) => {
  if (!INDEX_EXISTS) {
    return res.status(404).send("index.html não encontrado");
  }

  const html = renderIndexWithBootstrap();
  if (!html) {
    return sendHtmlWithNoCache(res, INDEX_HTML);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(html);
});

app.get("*", (_req, res) => {
  if (!INDEX_EXISTS) {
    return res.status(404).send("Not Found");
  }

  const html = renderIndexWithBootstrap();
  if (!html) {
    return sendHtmlWithNoCache(res, INDEX_HTML);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(html);
});

/* ------------------------------------------------------------------ */
/* Startup: hydrate first, then listen                                 */
/* ------------------------------------------------------------------ */

async function start() {
  try {
    await initDatabase(db);

    homepageVersion += 1;
    bumpProductsVersion();
    cachedIndexHtml = null;
    cachedIndexVersionKey = "";

    console.log("[DARAH] Database initialized and in memory cache hydrated.");
    console.log("[DARAH] Products loaded:", db.products.length);

    // Pre-generate cached HTML for instant first load
    if (INDEX_HTML_TEMPLATE) {
      renderIndexWithBootstrap();
      console.log("[DARAH] Pre-generated cached HTML for instant loading.");
    }
  } catch (err) {
    console.error(
      "[DARAH] Failed to initialize database. Continuing with in memory store only.",
      err
    );
  }

  app.listen(PORT, () => {
    console.log(`[DARAH] API rodando na porta ${PORT}`);
    console.log(`[DARAH] Storefront: http://localhost:${PORT}/`);
    console.log(`[DARAH] Admin: http://localhost:${PORT}/admin`);

    const keepAliveUrl = `http://127.0.0.1:${PORT}/api/health`;
    setInterval(() => {
      http
        .get(keepAliveUrl, (res) => {
          res.on("data", () => {});
          res.on("end", () => {});
        })
        .on("error", (err) => {
          console.error("[DARAH] keep alive ping failed:", err.message);
        });
    }, 5 * 60 * 1000);
  });
}

start();
