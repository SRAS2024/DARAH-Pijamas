"use strict";

/**
 * Simple Postgres persistence layer for DARAH
 * Uses DATABASE_URL (Railway: ${{ Postgres.DATABASE_URL }})
 * to persist homepage and products, while the rest
 * of the app keeps using the same in memory `db` object.
 */

const { Pool } = require("pg");

let pool = null;

/**
 * Lazily create the Pool only if DATABASE_URL is present.
 * If not present, the app continues to work purely in memory.
 */
function getPool() {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      "[db] DATABASE_URL is not set. Running in memory only, data will NOT persist across restarts."
    );
    return null;
  }

  const useSsl = url.includes("sslmode=require");

  pool = new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  pool.on("error", (err) => {
    console.error("[db] Unexpected error on idle client", err);
  });

  return pool;
}

/**
 * Create tables if they do not exist and hydrate the in memory `db`
 * from Postgres on startup.
 *
 * `db` is the same object defined in server.js:
 *   const db = { homepage: {...}, products: [] }
 */
async function initDatabase(db) {
  const pg = getPool();
  if (!pg) {
    // No DATABASE_URL, just use in memory
    return;
  }

  // 1) Ensure tables exist
  await pg.query(`
    CREATE TABLE IF NOT EXISTS homepage (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      about_text TEXT NOT NULL DEFAULT '',
      about_long_text TEXT NOT NULL DEFAULT '',
      hero_images JSONB NOT NULL DEFAULT '[]'::jsonb,
      notices JSONB NOT NULL DEFAULT '[]'::jsonb,
      theme TEXT NOT NULL DEFAULT 'default',
      about_images JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  // In case the table existed without the new columns, add them safely
  await pg.query(`
    ALTER TABLE homepage
      ADD COLUMN IF NOT EXISTS about_long_text TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS about_images JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10, 2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      original_price NUMERIC(10, 2),
      discount_label TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // In case the products table already existed without the new columns,
  // add them safely.
  await pg.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS discount_label TEXT;
  `);

  // Analytics tables
  await pg.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      page TEXT NOT NULL DEFAULT '/',
      visitor_id TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '',
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pg.query(`
    CREATE INDEX IF NOT EXISTS idx_visits_visitor_page ON visits (visitor_id, page, visited_at);
  `);
  await pg.query(`
    CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits (visited_at);
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS product_views (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pg.query(`
    CREATE INDEX IF NOT EXISTS idx_product_views_dedup ON product_views (visitor_id, product_id, viewed_at);
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS cart_events (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pg.query(`
    CREATE INDEX IF NOT EXISTS idx_cart_events_dedup ON cart_events (visitor_id, product_id, added_at);
  `);

  // 2) Hydrate homepage from DB, or seed from current in memory default
  const homeResult = await pg.query(
    "SELECT about_text, about_long_text, hero_images, notices, theme, about_images, logo_url FROM homepage WHERE id = 1"
  );

  if (homeResult.rows.length === 0) {
    // Seed from in memory default
    const home = db.homepage || {
      aboutText: "",
      aboutLongText: "",
      heroImages: [],
      notices: [],
      theme: "default",
      aboutImages: []
    };

    await pg.query(
      `
      INSERT INTO homepage (id, about_text, about_long_text, hero_images, notices, theme, about_images, logo_url)
      VALUES (1, $1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7)
      ON CONFLICT (id) DO NOTHING;
    `,
      [
        String(home.aboutText || ""),
        String(home.aboutLongText || ""),
        JSON.stringify(Array.isArray(home.heroImages) ? home.heroImages : []),
        JSON.stringify(Array.isArray(home.notices) ? home.notices : []),
        typeof home.theme === "string" ? home.theme : "default",
        JSON.stringify(Array.isArray(home.aboutImages) ? home.aboutImages : []),
        String(home.logoUrl || "")
      ]
    );

    db.homepage = home;
  } else {
    const row = homeResult.rows[0];
    db.homepage = {
      aboutText: row.about_text || "",
      aboutLongText: row.about_long_text || "",
      heroImages: Array.isArray(row.hero_images) ? row.hero_images : [],
      notices: Array.isArray(row.notices) ? row.notices : [],
      theme: row.theme || "default",
      aboutImages: Array.isArray(row.about_images) ? row.about_images : [],
      logoUrl: row.logo_url || ""
    };
  }

  // 3) Hydrate products from DB, including new fields
  const prodResult = await pg.query(`
    SELECT
      id,
      category,
      name,
      description,
      price,
      stock,
      image_url,
      image_urls,
      original_price,
      discount_label,
      active,
      created_at
    FROM products
    ORDER BY created_at ASC, name ASC;
  `);

  db.products = prodResult.rows.map((row) => {
    const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
    const originalPrice =
      row.original_price != null ? Number(row.original_price) : null;
    const discountLabel = row.discount_label || "";

    return {
      id: row.id,
      category: row.category,
      name: row.name,
      description: row.description || "",
      price: Number(row.price),
      stock: Number(row.stock),
      imageUrl: row.image_url || imageUrls[0] || "",
      imageUrls,
      originalPrice,
      discountLabel,
      active: row.active !== false,
      createdAt: row.created_at ? row.created_at.toISOString() : undefined
    };
  });
}

/**
 * Persist the current homepage object into Postgres.
 * `homepage` shape matches db.homepage in server.js.
 */
async function persistHomepage(homepage) {
  const pg = getPool();
  if (!pg) return;

  const aboutText = String(homepage.aboutText || "");
  const aboutLongText = String(homepage.aboutLongText || "");
  const heroImages = Array.isArray(homepage.heroImages) ? homepage.heroImages : [];
  const notices = Array.isArray(homepage.notices) ? homepage.notices : [];
  const aboutImages = Array.isArray(homepage.aboutImages) ? homepage.aboutImages : [];
  const theme =
    typeof homepage.theme === "string" && homepage.theme.length
      ? homepage.theme
      : "default";
  const logoUrl = String(homepage.logoUrl || "");

  await pg.query(
    `
    INSERT INTO homepage (id, about_text, about_long_text, hero_images, notices, theme, about_images, logo_url)
    VALUES (1, $1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7)
    ON CONFLICT (id) DO UPDATE SET
      about_text      = EXCLUDED.about_text,
      about_long_text = EXCLUDED.about_long_text,
      hero_images     = EXCLUDED.hero_images,
      notices         = EXCLUDED.notices,
      theme           = EXCLUDED.theme,
      about_images    = EXCLUDED.about_images,
      logo_url        = EXCLUDED.logo_url;
  `,
    [
      aboutText,
      aboutLongText,
      JSON.stringify(heroImages),
      JSON.stringify(notices),
      theme,
      JSON.stringify(aboutImages),
      logoUrl
    ]
  );
}

/**
 * Upsert a single product into Postgres to mirror the in memory change.
 * `product` is one element from db.products.
 */
async function persistProductUpsert(product) {
  const pg = getPool();
  if (!pg) return;
  if (!product || !product.id) return;

  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  const originalPrice =
    typeof product.originalPrice === "number" && !Number.isNaN(product.originalPrice)
      ? Number(product.originalPrice)
      : null;
  const discountLabel =
    typeof product.discountLabel === "string" ? product.discountLabel : "";

  await pg.query(
    `
    INSERT INTO products (
      id,
      category,
      name,
      description,
      price,
      stock,
      image_url,
      image_urls,
      original_price,
      discount_label,
      active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      category       = EXCLUDED.category,
      name           = EXCLUDED.name,
      description    = EXCLUDED.description,
      price          = EXCLUDED.price,
      stock          = EXCLUDED.stock,
      image_url      = EXCLUDED.image_url,
      image_urls     = EXCLUDED.image_urls,
      original_price = EXCLUDED.original_price,
      discount_label = EXCLUDED.discount_label,
      active         = EXCLUDED.active;
  `,
    [
      String(product.id),
      String(product.category || ""),
      String(product.name || ""),
      String(product.description || ""),
      Number(product.price || 0),
      Number(product.stock || 0),
      String(product.imageUrl || ""),
      JSON.stringify(imageUrls),
      originalPrice,
      discountLabel,
      product.active !== false
    ]
  );
}

/**
 * Delete a product from Postgres when it is removed
 * from the in memory db.products array.
 */
async function persistProductDelete(id) {
  const pg = getPool();
  if (!pg) return;
  if (!id) return;
  await pg.query("DELETE FROM products WHERE id = $1", [String(id)]);
}

/* ------------------------------------------------------------------ */
/* Analytics: visits, product views, cart events                       */
/* ------------------------------------------------------------------ */

/**
 * Record a page visit with deduplication.
 * Uses a visitor fingerprint (session id or IP+UA hash) and a cooldown
 * window (default 30 minutes) so rapid refreshes don't inflate counts.
 */
async function recordVisit({ page, visitorId, referrer }) {
  const pg = getPool();
  if (!pg) return;

  const COOLDOWN_MINUTES = 30;
  try {
    // Only insert if there is no visit from this visitor+page in the cooldown window
    await pg.query(
      `INSERT INTO visits (page, visitor_id, referrer)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM visits
         WHERE visitor_id = $2 AND page = $1
           AND visited_at > NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
       )`,
      [String(page || "/"), String(visitorId || "unknown"), String(referrer || "")]
    );
  } catch (err) {
    console.error("[db] Error recording visit:", err);
  }
}

/**
 * Record a product view with deduplication (same cooldown approach).
 */
async function recordProductView({ productId, visitorId }) {
  const pg = getPool();
  if (!pg) return;

  const COOLDOWN_MINUTES = 30;
  try {
    await pg.query(
      `INSERT INTO product_views (product_id, visitor_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM product_views
         WHERE visitor_id = $2 AND product_id = $1
           AND viewed_at > NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
       )`,
      [String(productId), String(visitorId || "unknown")]
    );
  } catch (err) {
    console.error("[db] Error recording product view:", err);
  }
}

/**
 * Record a cart addition event with deduplication.
 */
async function recordCartAdd({ productId, visitorId }) {
  const pg = getPool();
  if (!pg) return;

  const COOLDOWN_MINUTES = 10;
  try {
    await pg.query(
      `INSERT INTO cart_events (product_id, visitor_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM cart_events
         WHERE visitor_id = $2 AND product_id = $1
           AND added_at > NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
       )`,
      [String(productId), String(visitorId || "unknown")]
    );
  } catch (err) {
    console.error("[db] Error recording cart add:", err);
  }
}

/**
 * Get visit data for the insights dashboard.
 * @param {number} days - Number of days to look back (0 = today only)
 * @param {string} [page] - Optional page filter
 */
async function getVisitStats({ days, page }) {
  const pg = getPool();
  if (!pg) return { labels: [], counts: [], total: 0 };

  try {
    let interval;
    if (days === 0) {
      interval = "NOW()::date";
    } else {
      interval = `NOW() - INTERVAL '${Number(days) || 7} days'`;
    }

    const params = [];
    let pageFilter = "";
    if (page && page !== "all") {
      params.push(String(page));
      pageFilter = ` AND page = $${params.length}`;
    }

    // Get daily counts
    const result = await pg.query(
      `SELECT visited_at::date AS day, COUNT(*)::int AS count
       FROM visits
       WHERE visited_at >= ${interval}${pageFilter}
       GROUP BY day
       ORDER BY day ASC`,
      params
    );

    // Get total
    const totalResult = await pg.query(
      `SELECT COUNT(*)::int AS total FROM visits WHERE visited_at >= ${interval}${pageFilter}`,
      params
    );

    const labels = result.rows.map((r) => r.day.toISOString().split("T")[0]);
    const counts = result.rows.map((r) => r.count);
    const total = totalResult.rows[0]?.total || 0;

    return { labels, counts, total };
  } catch (err) {
    console.error("[db] Error getting visit stats:", err);
    return { labels: [], counts: [], total: 0 };
  }
}

/**
 * Get referrer-based visitor insights (e.g. Instagram referrals).
 */
async function getVisitorInsights({ days, page }) {
  const pg = getPool();
  if (!pg) return { total: 0, referrers: {} };

  try {
    let interval;
    if (days === 0) {
      interval = "NOW()::date";
    } else {
      interval = `NOW() - INTERVAL '${Number(days) || 7} days'`;
    }

    const params = [];
    let pageFilter = "";
    if (page && page !== "all") {
      params.push(String(page));
      pageFilter = ` AND page = $${params.length}`;
    }

    const totalResult = await pg.query(
      `SELECT COUNT(*)::int AS total FROM visits WHERE visited_at >= ${interval}${pageFilter}`,
      params
    );

    const referrerResult = await pg.query(
      `SELECT
         CASE
           WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
           WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%fb.%' THEN 'Facebook'
           WHEN referrer ILIKE '%google%' THEN 'Google'
           WHEN referrer ILIKE '%whatsapp%' THEN 'WhatsApp'
           WHEN referrer ILIKE '%tiktok%' THEN 'TikTok'
           WHEN referrer = '' OR referrer IS NULL THEN 'Direct'
           ELSE 'Other'
         END AS source,
         COUNT(*)::int AS count
       FROM visits
       WHERE visited_at >= ${interval}${pageFilter}
       GROUP BY source
       ORDER BY count DESC`,
      params
    );

    const total = totalResult.rows[0]?.total || 0;
    const referrers = {};
    referrerResult.rows.forEach((r) => {
      referrers[r.source] = r.count;
    });

    return { total, referrers };
  } catch (err) {
    console.error("[db] Error getting visitor insights:", err);
    return { total: 0, referrers: {} };
  }
}

/**
 * Get product view counts and cart add counts for admin display.
 */
async function getProductStats() {
  const pg = getPool();
  if (!pg) return { views: {}, cartAdds: {} };

  try {
    const viewsResult = await pg.query(
      `SELECT product_id, COUNT(*)::int AS count FROM product_views GROUP BY product_id`
    );
    const cartResult = await pg.query(
      `SELECT product_id, COUNT(*)::int AS count FROM cart_events GROUP BY product_id`
    );

    const views = {};
    viewsResult.rows.forEach((r) => { views[r.product_id] = r.count; });

    const cartAdds = {};
    cartResult.rows.forEach((r) => { cartAdds[r.product_id] = r.count; });

    return { views, cartAdds };
  } catch (err) {
    console.error("[db] Error getting product stats:", err);
    return { views: {}, cartAdds: {} };
  }
}

module.exports = {
  initDatabase,
  persistHomepage,
  persistProductUpsert,
  persistProductDelete,
  recordVisit,
  recordProductView,
  recordCartAdd,
  getVisitStats,
  getVisitorInsights,
  getProductStats
};
