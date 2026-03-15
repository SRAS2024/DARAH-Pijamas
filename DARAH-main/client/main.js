"use strict";

/**
 * DARAH · Shared script (Storefront + Admin)
 *
 * IMPORTANT:
 * - The storefront (index.html) and admin (admin.html) both load main.js.
 * - We auto-detect which page is running.
 * - Storefront code must run when admin sections are NOT present.
 * - Admin code must run when admin sections ARE present.
 */

/**
 * Prefer route-based detection first because it is stable.
 * Fallback to DOM detection only if the route is ambiguous.
 */
function isAdminRoute() {
  const path = String(window.location.pathname || "");
  const file = path.split("/").pop() || "";

  if (path === "/admin") return true;
  if (path.startsWith("/admin/")) return true;
  if (file.toLowerCase() === "admin.html") return true;

  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  const hasAdminLoginSection = !!document.getElementById("adminLoginSection");
  const hasAdminPanelSection = !!document.getElementById("adminPanelSection");
  const domLooksAdmin = hasAdminLoginSection || hasAdminPanelSection;

  const shouldRunAdmin = isAdminRoute() || domLooksAdmin;

  try {
    if (shouldRunAdmin) {
      initAdminApp();
    } else {
      initStorefrontApp();
    }
  } catch (err) {
    console.error("Boot error:", err);

    // Safety: if admin boot partially ran on storefront, undo the classes and try storefront.
    try {
      document.body.classList.remove("admin-page", "is-admin-login");
    } catch {
      // ignore
    }

    try {
      initStorefrontApp();
    } catch (err2) {
      console.error("Storefront fallback failed:", err2);
    }
  }
});

/* =========================================================
   RESPONSIVE MODE (shared helper)
   ========================================================= */

/**
 * Heuristic for "phone and small devices" versus "desktop/tablet".
 * Goal: devices larger than about 8 inches should behave like desktop.
 * We approximate this by:
 * - Treating small if the shortest viewport side is <= 700 CSS px
 * - Also treating small if it looks phone like (coarse pointer, touch, and smaller max side)
 */
function computeIsSmallDevice() {
  const w = Number(window.innerWidth || 0);
  const h = Number(window.innerHeight || 0);
  const minSide = Math.min(w, h);
  const maxSide = Math.max(w, h);

  const coarse =
    !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    !!(window.matchMedia && window.matchMedia("(hover: none)").matches);

  const touch = "ontouchstart" in window || (navigator && navigator.maxTouchPoints > 0);

  const smallByViewport = minSide <= 700;
  const smallPhoneLike = coarse && touch && maxSide <= 900 && minSide <= 820;

  return smallByViewport || smallPhoneLike;
}

function applyDeviceModeClass(bodyEl, isSmall) {
  if (!bodyEl) return;
  bodyEl.classList.toggle("is-small-device", !!isSmall);
  bodyEl.classList.toggle("is-large-device", !isSmall);
}

/**
 * Keeps a local isSmallDevice boolean in sync, updates body classes,
 * and calls onChange when the mode flips.
 */
function attachResponsiveMode(bodyEl, onChange) {
  let isSmallDevice = computeIsSmallDevice();
  applyDeviceModeClass(bodyEl, isSmallDevice);

  function sync() {
    const next = computeIsSmallDevice();
    if (next !== isSmallDevice) {
      isSmallDevice = next;
      applyDeviceModeClass(bodyEl, isSmallDevice);
      if (typeof onChange === "function") onChange(isSmallDevice);
    } else {
      applyDeviceModeClass(bodyEl, isSmallDevice);
    }
  }

  window.addEventListener("resize", sync, { passive: true });
  window.addEventListener("orientationchange", sync, { passive: true });

  return {
    isSmall: () => isSmallDevice,
    sync
  };
}

/* =========================================================
   STORE
   ========================================================= */

function initStorefrontApp() {
  // Safety: if admin code ever ran, these classes will break the storefront nav.
  try {
    document.body.classList.remove("admin-page", "is-admin-login");
  } catch {
    // ignore
  }

  // Elements
  const bodyEl = document.body;
  const navMobileToggle = document.querySelector(".nav-mobile-toggle");
  const navDropdown = document.getElementById("navDropdown");
  const navLeftContainer = document.querySelector(".nav-left");
  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));

  const views = {
    home: document.getElementById("view-home"),
    about: document.getElementById("view-about"),
    specials: document.getElementById("view-specials"),
    sets: document.getElementById("view-sets"),
    rings: document.getElementById("view-rings"),
    necklaces: document.getElementById("view-necklaces"),
    bracelets: document.getElementById("view-bracelets"),
    earrings: document.getElementById("view-earrings"),
    checkout: document.getElementById("view-checkout")
  };

  // Homepage areas
  const heroImagesEl = document.getElementById("heroImages");
  const aboutTextEl = document.getElementById("aboutText");
  const aboutLongTextEl = document.getElementById("aboutLongText");
  const aboutCollageEl = document.getElementById("aboutCollage");

  const siteNoticesEl = document.getElementById("siteNotices");
  const siteNoticesListEl = document.getElementById("siteNoticesList");

  // Product grids
  const productLists = {
    specials: document.getElementById("specialsList"),
    sets: document.getElementById("setsList"),
    rings: document.getElementById("ringsList"),
    necklaces: document.getElementById("necklacesList"),
    bracelets: document.getElementById("braceletsList"),
    earrings: document.getElementById("earringsList")
  };

  // Cart
  const cartButton = document.getElementById("cartButton");
  const cartCountEl = document.getElementById("cartCount");
  const checkoutItemsEl = document.getElementById("checkoutItems");
  const summarySubtotalEl = document.getElementById("summarySubtotal");
  const summaryTaxesEl = document.getElementById("summaryTaxes");
  const summaryTotalEl = document.getElementById("summaryTotal");
  const checkoutButton = document.getElementById("checkoutButton");

  // Year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // State
  const MAX_PRODUCT_IMAGES = 5;
  let allProducts = [];
  let homepageState = {
    aboutText: "",
    aboutLongText: "",
    heroImages: [],
    aboutImages: [],
    notices: [],
    theme: "default"
  };

  // Cart state
  const CART_STORAGE_KEY = "darahCartV1";

  /**
   * In-memory cart shape:
   * {
   *   [productId]: { qty: number, product: { id, name, price } OR full product object }
   * }
   *
   * We persist a compact version to localStorage to avoid quota issues caused by big image fields.
   */
  let cart = loadCart();

  // Responsive mode state
  let isSmallDevice = false;

  // Helpers
  function applyThemeVariant(variant) {
    const root = document.documentElement;
    const trimmed = typeof variant === "string" ? variant.trim() : "";
    const value = trimmed || "default";
    if (root) {
      root.dataset.themeVariant = value;
      root.setAttribute("data-theme-variant", value);
    }
  }

  function normalizeList(list, max) {
    if (!Array.isArray(list)) return [];
    const cleaned = list
      .map((u) => String(u || "").trim())
      .filter((u, index, arr) => u && arr.indexOf(u) === index);
    return typeof max === "number" && max > 0 ? cleaned.slice(0, max) : cleaned;
  }

  function formatBRL(value) {
    if (value == null || Number.isNaN(Number(value))) return "R$ 0,00";
    try {
      return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    } catch {
      return "R$ " + Number(value || 0).toFixed(2).replace(".", ",");
    }
  }

  function normalizeProductImages(product) {
    const primary = typeof product.imageUrl === "string" ? product.imageUrl : "";
    const fromImageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
    const fromImages = Array.isArray(product.images) ? product.images : [];
    const merged = [...fromImageUrls, ...fromImages];
    const cleaned = merged
      .map((u) => String(u || "").trim())
      .filter((u, index, arr) => u && arr.indexOf(u) === index);
    if (primary && !cleaned.includes(primary)) cleaned.unshift(primary);
    return cleaned.slice(0, MAX_PRODUCT_IMAGES);
  }

  function getProductById(productId) {
    const id = String(productId || "");
    if (!id) return null;
    const found = allProducts.find((p) => p && String(p.id || "") === id);
    return found || null;
  }

  function compactProduct(product) {
    if (!product || typeof product !== "object") return null;
    const id = String(product.id || "");
    if (!id) return null;

    const name = typeof product.name === "string" ? product.name : "";
    const price = Number(product.price || 0);

    return {
      id,
      name,
      price: Number.isFinite(price) ? price : 0
    };
  }

  function normalizeLoadedCart(loaded) {
    // Supports:
    // - Legacy flat map: { [id]: { qty, product: fullProduct } }
    // - New wrapper: { _meta: {...}, items: { [id]: { qty, product: compact } } }
    // - Quota fallback: { _meta: {...}, qtyOnly: { [id]: qty } }
    if (!loaded || typeof loaded !== "object") return {};

    let items = loaded;

    if (loaded && typeof loaded === "object" && loaded.items && typeof loaded.items === "object") {
      items = loaded.items;
    }

    // qtyOnly snapshot (very small)
    if (loaded && typeof loaded === "object" && loaded.qtyOnly && typeof loaded.qtyOnly === "object") {
      const out = {};
      for (const [id, qtyVal] of Object.entries(loaded.qtyOnly)) {
        const idStr = String(id || "");
        const qty = Math.floor(Number(qtyVal || 0));
        if (!idStr || !Number.isFinite(qty) || qty <= 0) continue;

        const resolved = getProductById(idStr);
        const prod = resolved ? resolved : { id: idStr, name: "", price: 0 };
        out[idStr] = { qty, product: compactProduct(prod) || { id: idStr, name: "", price: 0 } };
      }
      return out;
    }

    const out = {};
    for (const [id, row] of Object.entries(items)) {
      const idStr = String(id || "");
      if (!idStr) continue;

      const qty = row && typeof row === "object" ? Math.floor(Number(row.qty || 0)) : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      // Prefer current catalog product if available (best name/price)
      const resolved = getProductById(idStr);

      let prod = null;
      if (resolved) {
        prod = resolved;
      } else if (row && typeof row === "object" && row.product && typeof row.product === "object") {
        prod = row.product;
      } else {
        prod = { id: idStr, name: "", price: 0 };
      }

      out[idStr] = { qty, product: prod };
    }

    return out;
  }

  function buildQtyOnlySnapshot(cartMap) {
    const out = {};
    if (!cartMap || typeof cartMap !== "object") return out;

    for (const [id, row] of Object.entries(cartMap)) {
      const idStr = String(id || "");
      if (!idStr) continue;
      const qty = row && typeof row === "object" ? Math.floor(Number(row.qty || 0)) : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;
      out[idStr] = qty;
    }
    return out;
  }

  // Views
  function switchView(id) {
    Object.values(views).forEach((v) => v && v.classList.remove("active-view"));
    const el = views[id];
    if (el) el.classList.add("active-view");

    navLinks.forEach((b) => {
      const viewId = b.dataset.view;
      b.classList.toggle("active", viewId === id);
    });

    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Mobile menu
  function openMobileMenu() {
    if (!navDropdown || !navMobileToggle) return;
    if (!isSmallDevice) return;
    navDropdown.classList.add("open");
    navMobileToggle.classList.add("is-open");
    navMobileToggle.setAttribute("aria-expanded", "true");
    navDropdown.setAttribute("aria-hidden", "false");
  }

  function closeMobileMenu() {
    if (!navDropdown || !navMobileToggle) return;
    navDropdown.classList.remove("open");
    navMobileToggle.classList.remove("is-open");
    navMobileToggle.setAttribute("aria-expanded", "false");
    navDropdown.setAttribute("aria-hidden", "true");
  }

  function buildMobileDropdown() {
    if (!navDropdown || !navLeftContainer) return;

    navDropdown.innerHTML = "";

    const allTabs = Array.from(navLeftContainer.querySelectorAll(".nav-link"));

    allTabs.forEach((btn) => {
      const viewId = btn.getAttribute("data-view");
      if (!viewId || !views[viewId]) return;

      const clone = btn.cloneNode(true);
      clone.classList.remove("active");

      clone.addEventListener("click", () => {
        switchView(viewId);

        const dropdownLinks = navDropdown.querySelectorAll(".nav-link");
        dropdownLinks.forEach((linkEl) => {
          linkEl.classList.toggle("active", linkEl === clone);
        });
      });

      navDropdown.appendChild(clone);
    });
  }

  // Wire nav clicks
  navLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.view;
      if (id && views[id]) switchView(id);
    });
  });

  // Wire hamburger
  buildMobileDropdown();

  if (navMobileToggle && navDropdown) {
    navMobileToggle.addEventListener("click", () => {
      if (!isSmallDevice) {
        closeMobileMenu();
        return;
      }
      const isOpen = navDropdown.classList.contains("open");
      if (isOpen) closeMobileMenu();
      else openMobileMenu();
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (!navDropdown.contains(target) && !navMobileToggle.contains(target)) {
        closeMobileMenu();
      }
    });
  }

  // Keep responsive mode synced, and force close mobile menu when switching to desktop mode
  const responsive = attachResponsiveMode(bodyEl, (nextIsSmall) => {
    isSmallDevice = nextIsSmall;
    if (!isSmallDevice) closeMobileMenu();
  });
  isSmallDevice = responsive.isSmall();

  // Cart helpers
  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const normalized = normalizeLoadedCart(parsed);

      // Auto-migrate legacy heavy carts into compact storage.
      // We do not overwrite in-memory product objects, only what we persist.
      cart = normalized;
      saveCart();

      return normalized;
    } catch {
      return {};
    }
  }

  function saveCart() {
    // Persist a compact cart to prevent localStorage quota failures caused by image fields.
    const compactItems = {};
    for (const [id, row] of Object.entries(cart || {})) {
      const idStr = String(id || "");
      if (!idStr) continue;

      const qty = row && typeof row === "object" ? Math.floor(Number(row.qty || 0)) : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      // Prefer catalog product for correct name/price
      const resolved = getProductById(idStr);
      const prodSource = resolved || (row && row.product ? row.product : null);
      const compact = compactProduct(prodSource) || { id: idStr, name: "", price: 0 };

      compactItems[idStr] = { qty, product: compact };
    }

    const payload = {
      _meta: { v: 2, mode: "compact" },
      items: compactItems
    };

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Fallback: store only quantities. This is very small and avoids losing the cart.
      try {
        const qtyOnly = buildQtyOnlySnapshot(cart);
        const fallbackPayload = {
          _meta: { v: 2, mode: "qtyOnly" },
          qtyOnly
        };
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(fallbackPayload));
      } catch {
        // ignore
      }
    }
  }

  function getCartCount() {
    return Object.values(cart).reduce((sum, item) => sum + (item.qty || 0), 0);
  }

  function updateCartBadge() {
    if (!cartCountEl) return;
    cartCountEl.textContent = String(getCartCount());
  }

  function addToCart(product, qty) {
    const id = String(product.id || "");
    if (!id) return;

    const safeQty = Math.max(1, Number(qty || 1));
    if (!cart[id]) cart[id] = { qty: 0, product };
    cart[id].qty += safeQty;

    // Keep full product in memory for UI, but persist compact.
    cart[id].product = product;

    saveCart();
    updateCartBadge();
  }

  function setCartQty(productId, qty) {
    const id = String(productId || "");
    if (!id || !cart[id]) return;

    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      delete cart[id];
    } else {
      cart[id].qty = Math.floor(n);
    }

    saveCart();
    updateCartBadge();
    renderCheckout();
  }

  function buildCheckoutItemsFromCart(cartMap) {
    const items = [];
    if (!cartMap || typeof cartMap !== "object") return items;

    for (const [id, row] of Object.entries(cartMap)) {
      const idStr = String(id || "");
      if (!idStr) continue;

      const qty = row && typeof row === "object" ? Math.floor(Number(row.qty || 0)) : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const resolved = getProductById(idStr);

      const prod = resolved || (row && row.product ? row.product : null);
      const name = prod && typeof prod.name === "string" ? prod.name : "";
      const priceNum = prod ? Number(prod.price || 0) : 0;

      items.push({
        id: idStr,
        name: name || "Produto",
        price: Number.isFinite(priceNum) ? priceNum : 0,
        quantity: qty
      });
    }

    // Stable, clean ordering in the WhatsApp message
    items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

    return items;
  }

  // Checkout rendering
  function renderCheckout() {
    if (!checkoutItemsEl || !summarySubtotalEl || !summaryTaxesEl || !summaryTotalEl) return;

    checkoutItemsEl.innerHTML = "";

    const items = Object.entries(cart)
      .map(([id, row]) => {
        const resolved = getProductById(id);
        const prod = resolved || (row ? row.product : null);
        return { id, qty: row && row.qty ? row.qty : 0, product: prod };
      })
      .filter((x) => x.product && x.qty > 0);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "checkout-empty";
      empty.textContent = "Seu carrinho está vazio.";
      checkoutItemsEl.appendChild(empty);

      summarySubtotalEl.textContent = "R$ 0,00";
      summaryTaxesEl.textContent = "R$ 0,00";
      summaryTotalEl.textContent = "R$ 0,00";
      if (checkoutButton) checkoutButton.disabled = true;
      return;
    }

    let subtotal = 0;

    items.forEach(({ id, qty, product }) => {
      const price = Number(product.price || 0);
      const lineTotal = price * qty;
      subtotal += lineTotal;

      const row = document.createElement("div");
      row.className = "checkout-item";

      const imgBox = document.createElement("div");
      imgBox.className = "checkout-item-image";
      const images = normalizeProductImages(product);
      if (images.length) {
        const img = document.createElement("img");
        img.src = images[0];
        img.alt = product.name || "Produto";
        img.loading = "lazy";
        imgBox.appendChild(img);
      }
      row.appendChild(imgBox);

      const info = document.createElement("div");
      info.className = "checkout-item-info";

      const name = document.createElement("div");
      name.className = "checkout-item-name";
      name.textContent = product.name || "Produto";
      info.appendChild(name);

      const unit = document.createElement("div");
      unit.className = "checkout-item-unit";
      unit.textContent = "Unitário: " + formatBRL(price);
      info.appendChild(unit);

      const total = document.createElement("div");
      total.className = "checkout-item-total";
      total.textContent = "Total: " + formatBRL(lineTotal);
      info.appendChild(total);

      row.appendChild(info);

      const controls = document.createElement("div");
      controls.className = "checkout-item-controls";

      const qtyControls = document.createElement("div");
      qtyControls.className = "quantity-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "quantity-button";
      minus.textContent = "−";
      minus.addEventListener("click", () => setCartQty(id, qty - 1));

      const qtyValue = document.createElement("div");
      qtyValue.className = "quantity-value";
      qtyValue.textContent = String(qty);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "quantity-button";
      plus.textContent = "+";
      plus.addEventListener("click", () => setCartQty(id, qty + 1));

      qtyControls.appendChild(minus);
      qtyControls.appendChild(qtyValue);
      qtyControls.appendChild(plus);

      controls.appendChild(qtyControls);
      row.appendChild(controls);

      checkoutItemsEl.appendChild(row);
    });

    const taxes = 0;
    const total = subtotal + taxes;

    summarySubtotalEl.textContent = formatBRL(subtotal);
    summaryTaxesEl.textContent = formatBRL(taxes);
    summaryTotalEl.textContent = formatBRL(total);

    if (checkoutButton) checkoutButton.disabled = false;
  }

  // Product cards
  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = String(product.id || "");

    const images = normalizeProductImages(product);

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "product-image-wrapper";

    if (images.length <= 1) {
      if (images.length === 1) {
        const img = document.createElement("img");
        img.src = images[0];
        img.alt = product.name || "Produto";
        img.loading = "lazy";
        imageWrapper.appendChild(img);
      }
    } else {
      const viewport = document.createElement("div");
      viewport.className = "product-image-viewport";

      const track = document.createElement("div");
      track.className = "product-image-track";

      images.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = product.name || "Produto";
        img.loading = "lazy";
        track.appendChild(img);
      });

      viewport.appendChild(track);
      imageWrapper.appendChild(viewport);

      const controls = document.createElement("div");
      controls.className = "product-carousel-controls";

      const leftBtn = document.createElement("button");
      leftBtn.type = "button";
      leftBtn.className = "product-carousel-arrow product-carousel-arrow-left";
      leftBtn.textContent = "‹";

      const indicator = document.createElement("div");
      indicator.className = "product-carousel-indicator";

      const rightBtn = document.createElement("button");
      rightBtn.type = "button";
      rightBtn.className = "product-carousel-arrow product-carousel-arrow-right";
      rightBtn.textContent = "›";

      controls.appendChild(leftBtn);
      controls.appendChild(indicator);
      controls.appendChild(rightBtn);
      viewport.appendChild(controls);

      let currentIndex = 0;
      function updateCarousel() {
        const index = Math.max(0, Math.min(images.length - 1, currentIndex));
        currentIndex = index;
        track.style.transform = "translateX(" + String(-index * 100) + "%)";
        indicator.textContent = String(index + 1) + "/" + String(images.length);
        leftBtn.disabled = index === 0;
        rightBtn.disabled = index === images.length - 1;
      }

      leftBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex -= 1;
          updateCarousel();
        }
      });

      rightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex < images.length - 1) {
          currentIndex += 1;
          updateCarousel();
        }
      });

      updateCarousel();
    }

    card.appendChild(imageWrapper);

    const content = document.createElement("div");
    content.className = "product-content";

    const name = document.createElement("div");
    name.className = "product-name";
    name.textContent = product.name || "Produto";
    content.appendChild(name);

    const desc = document.createElement("div");
    desc.className = "product-description";
    desc.textContent = product.description || "Peça da coleção DARAH.";
    content.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "product-meta";

    const priceBlock = document.createElement("div");
    priceBlock.className = "product-price-block";

    const hasOffer =
      typeof product.originalPrice === "number" &&
      typeof product.price === "number" &&
      product.originalPrice > product.price;

    if (hasOffer) {
      const original = document.createElement("span");
      original.className = "product-price-original";
      original.textContent = formatBRL(product.originalPrice);
      priceBlock.appendChild(original);

      const current = document.createElement("span");
      current.className = "product-price-current";
      current.textContent = formatBRL(product.price);
      priceBlock.appendChild(current);

      if (product.discountLabel) {
        const lbl = document.createElement("span");
        lbl.className = "product-discount-label";
        lbl.textContent = String(product.discountLabel);
        priceBlock.appendChild(lbl);
      }
    } else {
      const price = document.createElement("span");
      price.className = "product-price";
      price.textContent = formatBRL(product.price);
      priceBlock.appendChild(price);
    }

    meta.appendChild(priceBlock);

    const stock = document.createElement("div");
    stock.className = "product-stock";
    if (typeof product.stock === "number") {
      stock.textContent = product.stock > 0 ? "Estoque: " + product.stock : "Sem estoque";
    } else {
      stock.textContent = "Estoque: -";
    }
    meta.appendChild(stock);

    content.appendChild(meta);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "primary-button";
    addBtn.textContent = "Adicionar ao carrinho";

    const outOfStock = typeof product.stock === "number" && product.stock <= 0;
    addBtn.disabled = outOfStock;

    addBtn.addEventListener("click", () => {
      addToCart(product, 1);
    });

    content.appendChild(addBtn);

    card.appendChild(content);

    return card;
  }

  function renderProducts() {
    Object.keys(productLists).forEach((cat) => {
      const container = productLists[cat];
      if (!container) return;
      container.innerHTML = "";

      const items = allProducts.filter((p) => p && p.category === cat);
      items.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (a.id && b.id) return String(b.id).localeCompare(String(a.id));
        return 0;
      });

      if (!items.length) {
        return;
      }

      const frag = document.createDocumentFragment();
      items.forEach((p) => frag.appendChild(createProductCard(p)));
      container.appendChild(frag);
    });

    // If products loaded after cart, refresh checkout so images show and names/prices match catalog.
    renderCheckout();
  }

  // Homepage rendering
  function renderHomepage() {
    const notices = Array.isArray(homepageState.notices) ? homepageState.notices : [];
    if (siteNoticesEl && siteNoticesListEl) {
      if (notices.length) {
        siteNoticesEl.style.display = "";
        siteNoticesListEl.innerHTML = "";
        const frag = document.createDocumentFragment();
        notices.forEach((n) => {
          const p = document.createElement("p");
          p.className = "home-highlight-text";
          p.style.margin = "0 0 10px 0";
          p.textContent = String(n || "").trim();
          frag.appendChild(p);
        });
        siteNoticesListEl.appendChild(frag);
      } else {
        siteNoticesEl.style.display = "none";
        siteNoticesListEl.innerHTML = "";
      }
    }

    if (aboutTextEl) aboutTextEl.textContent = homepageState.aboutText || "";

    if (heroImagesEl) {
      heroImagesEl.innerHTML = "";
      const heroImages = normalizeList(homepageState.heroImages || [], 12);
      const heroSection = heroImagesEl.closest(".hero");

      if (!heroImages.length) {
        if (heroSection) heroSection.classList.add("hero-no-images");
      } else {
        if (heroSection) heroSection.classList.remove("hero-no-images");
        const frag = document.createDocumentFragment();
        heroImages.forEach((src) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Imagem da homepage";
          img.loading = "lazy";
          frag.appendChild(img);
        });
        heroImagesEl.appendChild(frag);
      }
    }

    if (aboutLongTextEl) {
      const text = homepageState.aboutLongText || homepageState.aboutText || "";
      aboutLongTextEl.textContent = text;
    }

    if (aboutCollageEl) {
      aboutCollageEl.innerHTML = "";
      const aboutImages = normalizeList(homepageState.aboutImages || [], 4);

      if (!aboutImages.length) {
        aboutCollageEl.style.display = "none";
      } else {
        aboutCollageEl.style.display = "grid";
        const frag = document.createDocumentFragment();
        aboutImages.forEach((src) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Imagem da página Sobre";
          img.loading = "lazy";
          frag.appendChild(img);
        });
        aboutCollageEl.appendChild(frag);
      }
    }

    applyThemeVariant(homepageState.theme || "default");
  }

  // Data loading with bootstrap support for instant loading
  async function loadHomepage() {
    try {
      if (window.__DARAH_BOOTSTRAP__ && window.__DARAH_BOOTSTRAP__.homepage) {
        const hp = window.__DARAH_BOOTSTRAP__.homepage;

        homepageState.aboutText = typeof hp.aboutText === "string" ? hp.aboutText : "";
        homepageState.aboutLongText = typeof hp.aboutLongText === "string" ? hp.aboutLongText : "";
        homepageState.notices = normalizeList(hp.notices || [], 10);
        homepageState.theme = typeof hp.theme === "string" ? hp.theme : "default";
        homepageState.heroImages = [];
        homepageState.aboutImages = [];

        renderHomepage();

        if (window.__DARAH_BOOTSTRAP__.imagesDeferred) {
          if (window.requestIdleCallback) {
            requestIdleCallback(
              () => {
                setTimeout(loadHomepageImages, 300);
              },
              { timeout: 2000 }
            );
          } else {
            setTimeout(loadHomepageImages, 800);
          }
        }
        return;
      }

      const res = await fetch("/api/homepage", { cache: "no-store" });
      if (!res.ok) throw new Error("homepage fetch failed");
      const hp = await res.json();

      homepageState.aboutText = typeof hp.aboutText === "string" ? hp.aboutText : "";
      homepageState.aboutLongText = typeof hp.aboutLongText === "string" ? hp.aboutLongText : "";
      homepageState.heroImages = normalizeList(hp.heroImages || [], 12);
      homepageState.aboutImages = normalizeList(hp.aboutImages || [], 4);
      homepageState.notices = normalizeList(hp.notices || [], 10);
      homepageState.theme = typeof hp.theme === "string" ? hp.theme : "default";

      renderHomepage();
    } catch (err) {
      console.error(err);
      renderHomepage();
    }
  }

  async function loadHomepageImages() {
    try {
      const res = await fetch("/api/homepage", { cache: "default" });
      if (!res.ok) return;
      const hp = await res.json();

      homepageState.heroImages = normalizeList(hp.heroImages || [], 12);
      homepageState.aboutImages = normalizeList(hp.aboutImages || [], 4);

      renderHomepage();
    } catch (err) {
      console.error("Failed to load images:", err);
    }
  }

  async function loadProducts() {
    try {
      if (window.__DARAH_BOOTSTRAP__ && window.__DARAH_BOOTSTRAP__.products) {
        const products = window.__DARAH_BOOTSTRAP__.products;

        if (Array.isArray(products)) {
          allProducts = products;
        } else if (products && typeof products === "object") {
          const flat = [];
          ["specials", "sets", "rings", "necklaces", "bracelets", "earrings"].forEach((key) => {
            if (Array.isArray(products[key])) products[key].forEach((p) => flat.push(p));
          });
          allProducts = flat;
        } else {
          allProducts = [];
        }

        renderProducts();

        if (window.__DARAH_BOOTSTRAP__.imagesDeferred) {
          if (window.requestIdleCallback) {
            requestIdleCallback(
              () => {
                setTimeout(loadProductImages, 500);
              },
              { timeout: 2000 }
            );
          } else {
            setTimeout(loadProductImages, 1000);
          }
        }
        return;
      }

      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error("products fetch failed");
      const products = await res.json();

      if (Array.isArray(products)) {
        allProducts = products;
      } else if (products && typeof products === "object") {
        const flat = [];
        ["specials", "sets", "rings", "necklaces", "bracelets", "earrings"].forEach((key) => {
          if (Array.isArray(products[key])) products[key].forEach((p) => flat.push(p));
        });
        allProducts = flat;
      } else {
        allProducts = [];
      }

      renderProducts();
    } catch (err) {
      console.error(err);
      allProducts = [];
      renderProducts();
    }
  }

  async function loadProductImages() {
    try {
      const res = await fetch("/api/products", { cache: "default" });
      if (!res.ok) return;
      const products = await res.json();

      if (Array.isArray(products)) {
        allProducts = products;
      } else if (products && typeof products === "object") {
        const flat = [];
        ["specials", "sets", "rings", "necklaces", "bracelets", "earrings"].forEach((key) => {
          if (Array.isArray(products[key])) products[key].forEach((p) => flat.push(p));
        });
        allProducts = flat;
      }

      renderProducts();
    } catch (err) {
      console.error("Failed to load product images:", err);
    }
  }

  // Cart UI wiring
  updateCartBadge();

  if (cartButton) {
    cartButton.addEventListener("click", () => {
      renderCheckout();
      switchView("checkout");
    });
  }

  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      const popup = window.open("about:blank", "_blank");

      (async () => {
        let wasDisabled = false;
        try {
          if (checkoutButton && !checkoutButton.disabled) {
            checkoutButton.disabled = true;
            wasDisabled = true;
          }

          // IMPORTANT: use the in-memory cart so WhatsApp always reflects what the UI shows.
          // We still persist the cart, but we do not reload here because localStorage can be stale
          // if a previous save failed due to quota.
          const cartItems = buildCheckoutItemsFromCart(cart);

          if (!cartItems.length) {
            alert("Seu carrinho está vazio. Adicione itens antes de finalizar o pedido.");
            if (popup && !popup.closed) popup.close();
            return;
          }

          const res = await fetch("/api/checkout-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cartItems })
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Falha ao gerar link de checkout");
          }

          const data = await res.json();

          if (data.url) {
            if (popup && !popup.closed) {
              popup.location.href = data.url;
            } else {
              window.location.href = data.url;
            }
          } else {
            if (popup && !popup.closed) popup.close();
            alert("Erro ao gerar link do WhatsApp. Tente novamente.");
          }
        } catch (err) {
          console.error("Checkout error:", err);
          if (popup && !popup.closed) popup.close();
          alert("Erro ao finalizar pedido: " + err.message);
        } finally {
          if (checkoutButton && wasDisabled) checkoutButton.disabled = false;
        }
      })();
    });
  }

  // Initial view and load
  switchView("home");
  loadHomepage();
  renderCheckout();
  loadProducts();
}

/* =========================================================
   ADMIN
   ========================================================= */

function initAdminApp() {
  // Limits
  const MAX_PRODUCT_IMAGES = 5;
  const MAX_HOMEPAGE_IMAGES = 12;
  const MAX_ABOUT_IMAGES = 4;

  // Basic layout
  const bodyEl = document.body;
  if (bodyEl) bodyEl.classList.add("admin-page");

  const navMobileToggle = document.querySelector(".nav-mobile-toggle");
  const navDropdown = document.getElementById("navDropdown");
  const navLeftContainer = document.querySelector(".nav-left");

  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  const views = {
    home: document.getElementById("view-home"),
    about: document.getElementById("view-about"),
    specials: document.getElementById("view-specials"),
    sets: document.getElementById("view-sets"),
    rings: document.getElementById("view-rings"),
    necklaces: document.getElementById("view-necklaces"),
    bracelets: document.getElementById("view-bracelets"),
    earrings: document.getElementById("view-earrings")
  };

  // Auth and panel sections
  const loginSection = document.getElementById("adminLoginSection");
  const loginButton = document.getElementById("adminLoginButton");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const loginErrorEl = document.getElementById("adminLoginError");
  const loadingSection = document.getElementById("adminLoadingSection");
  const welcomeMessageEl = document.getElementById("adminWelcomeMessage");
  const panelSection = document.getElementById("adminPanelSection");

  const logoutButton = document.getElementById("adminLogoutButton");
  const userNameLabel = document.getElementById("adminUserNameLabel");
  const themeSelect = document.getElementById("adminThemeSelect");

  // Homepage admin controls
  const aboutTextEl = document.getElementById("adminAboutText");
  const heroGalleryEl = document.getElementById("adminHeroGallery");
  const heroImagesTextarea = document.getElementById("adminHeroImages");
  const heroImagesFileInput = document.getElementById("adminHeroImagesFile");
  const heroImagesFileButton = document.getElementById("adminHeroImagesFileButton");
  const saveHomepageBtn = document.getElementById("saveHomepageBtn");
  const homepageStatusEl = document.getElementById("adminHomepageStatus");

  const aboutLongTextEl = document.getElementById("adminAboutLongText");

  const addNoticeBtn = document.getElementById("adminAddNoticeBtn");
  const noticeListEl = document.getElementById("adminNoticeList");
  const noticeStatusEl = document.getElementById("adminNoticeStatus");
  const noticeItemTemplate = document.getElementById("noticeItemTemplate");

  const aboutCollageEl = document.getElementById("adminAboutCollagePreview");
  const aboutImagePreviewEl = document.getElementById("adminAboutImagePreview");
  const aboutImagePlaceholderEl = document.getElementById("adminAboutImagePlaceholder");
  const aboutImagesTextarea = document.getElementById("adminAboutImages");
  const aboutImagesFileInput = document.getElementById("adminAboutImagesFile");
  const aboutImagesFileButton = document.getElementById("adminAboutImagesFileButton");
  const aboutSaveStatusEl = document.getElementById("adminAboutSaveStatus");
  const saveAboutPageBtn = document.getElementById("saveAboutPageBtn");

  const productModalBackdrop = document.getElementById("adminProductModalBackdrop");
  const productModalTitle = document.getElementById("adminProductModalTitle");
  const productModalClose = document.getElementById("adminProductModalClose");
  const productDeleteButton = document.getElementById("productDeleteButton");
  const addCardTemplate = document.getElementById("adminAddCardTemplate");
  const productCardTemplate = document.getElementById("adminProductCardTemplate");
  const productImagePreview = document.getElementById("productImagePreview");
  const productImagePlaceholder = document.getElementById("productImagePlaceholder");
  const productImageFileButton = document.getElementById("productImageFileButton");
  const productImageThumbs = document.getElementById("productImageThumbs");

  const hiddenForm = {
    el: document.getElementById("productForm"),
    category: document.getElementById("productCategory"),
    name: document.getElementById("productName"),
    description: document.getElementById("productDescription"),
    price: document.getElementById("productPrice"),
    originalPrice: document.getElementById("productOriginalPrice"),
    discountLabel: document.getElementById("productDiscountLabel"),
    stock: document.getElementById("productStock"),
    imageUrl: document.getElementById("productImageUrl"),
    imageFile: document.getElementById("productImageFile"),
    status: document.getElementById("adminProductFormStatus")
  };

  const grids = {
    specials: document.getElementById("grid-specials"),
    sets: document.getElementById("grid-sets"),
    rings: document.getElementById("grid-rings"),
    necklaces: document.getElementById("grid-necklaces"),
    bracelets: document.getElementById("grid-bracelets"),
    earrings: document.getElementById("grid-earrings")
  };

  // State
  let allProducts = [];
  let homepageState = {
    aboutText: "",
    aboutLongText: "",
    heroImages: [],
    notices: [],
    theme: "default",
    aboutImages: []
  };
  let currentProductEditing = null;
  let currentProductImages = [];

  let isSmallDevice = false;

  /* ---- Helpers ---- */

  function normalizeList(list, max) {
    if (!Array.isArray(list)) return [];
    const cleaned = list
      .map(function (u) { return String(u || "").trim(); })
      .filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    return typeof max === "number" && max > 0 ? cleaned.slice(0, max) : cleaned;
  }

  function formatBRL(value) {
    if (value == null || Number.isNaN(Number(value))) return "R$ 0,00";
    try {
      return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch (e) {
      return "R$ " + Number(value || 0).toFixed(2).replace(".", ",");
    }
  }

  function applyThemeVariant(variant) {
    var root = document.documentElement;
    var value = (typeof variant === "string" ? variant.trim() : "") || "default";
    if (root) {
      root.dataset.themeVariant = value;
      root.setAttribute("data-theme-variant", value);
    }
  }

  function setBodyLoginMode(isLogin) {
    if (!bodyEl) return;
    if (isLogin) bodyEl.classList.add("is-admin-login");
    else bodyEl.classList.remove("is-admin-login");
  }

  function showLoginError(msg) {
    if (!loginErrorEl) return;
    loginErrorEl.textContent = msg || "";
    loginErrorEl.style.display = msg ? "block" : "none";
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg || "";
    el.className = "admin-status" + (type === "ok" ? " ok" : type === "error" ? " error" : "");
  }

  /* ---- View switching ---- */

  function switchView(id) {
    Object.values(views).forEach(function (v) {
      if (v) v.classList.remove("active-view");
    });
    var el = views[id];
    if (el) el.classList.add("active-view");

    navLinks.forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === id);
    });

    // Sync dropdown active states
    if (navDropdown) {
      var dropLinks = navDropdown.querySelectorAll(".nav-link");
      dropLinks.forEach(function (b) {
        b.classList.toggle("active", b.dataset.view === id);
      });
    }

    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---- Mobile menu ---- */

  function openMobileMenu() {
    if (!navDropdown || !navMobileToggle) return;
    if (!isSmallDevice) return;
    navDropdown.classList.add("open");
    navMobileToggle.classList.add("is-open");
    navMobileToggle.setAttribute("aria-expanded", "true");
    navDropdown.setAttribute("aria-hidden", "false");
  }

  function closeMobileMenu() {
    if (!navDropdown || !navMobileToggle) return;
    navDropdown.classList.remove("open");
    navMobileToggle.classList.remove("is-open");
    navMobileToggle.setAttribute("aria-expanded", "false");
    navDropdown.setAttribute("aria-hidden", "true");
  }

  function buildMobileDropdown() {
    if (!navDropdown || !navLeftContainer) return;
    navDropdown.innerHTML = "";

    // Add admin extras at top of dropdown (theme, user, logout)
    var extras = document.createElement("div");
    extras.className = "admin-mobile-extras";

    var themeRow = document.createElement("div");
    themeRow.className = "admin-mobile-row";
    var themeLabel = document.createElement("span");
    themeLabel.className = "admin-mobile-label";
    themeLabel.textContent = "Tema";
    var themeSelectClone = document.createElement("select");
    themeSelectClone.className = "admin-theme-select";
    themeSelectClone.innerHTML = '<option value="default">Padrão</option><option value="natal">Natal</option><option value="pascoa">Páscoa</option>';
    themeSelectClone.value = homepageState.theme || "default";
    themeSelectClone.addEventListener("change", function () {
      var v = themeSelectClone.value;
      if (themeSelect) themeSelect.value = v;
      handleThemeChange(v);
    });
    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeSelectClone);
    extras.appendChild(themeRow);

    var userRow = document.createElement("div");
    userRow.className = "admin-mobile-row";
    var userLabel = document.createElement("span");
    userLabel.className = "admin-mobile-user";
    userLabel.textContent = (userNameLabel && userNameLabel.textContent) || "Admin";
    var badge = document.createElement("span");
    badge.className = "admin-mobile-badge";
    badge.textContent = "Painel administrativo";
    userRow.appendChild(userLabel);
    userRow.appendChild(badge);
    extras.appendChild(userRow);

    var logoutRow = document.createElement("div");
    logoutRow.className = "admin-mobile-row";
    var logoutBtn = document.createElement("button");
    logoutBtn.className = "admin-button-secondary admin-logout-button";
    logoutBtn.textContent = "Sair";
    logoutBtn.addEventListener("click", handleLogout);
    logoutRow.appendChild(logoutBtn);
    extras.appendChild(logoutRow);

    navDropdown.appendChild(extras);

    var allTabs = Array.from(navLeftContainer.querySelectorAll(".nav-link"));
    allTabs.forEach(function (btn) {
      var viewId = btn.getAttribute("data-view");
      if (!viewId || !views[viewId]) return;

      var clone = btn.cloneNode(true);
      clone.classList.remove("active");
      clone.addEventListener("click", function () {
        switchView(viewId);
      });
      navDropdown.appendChild(clone);
    });
  }

  // Wire nav clicks for view switching
  navLinks.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.dataset.view;
      if (id && views[id]) switchView(id);
    });
  });

  // Wire hamburger toggle
  if (navMobileToggle && navDropdown) {
    navMobileToggle.addEventListener("click", function () {
      if (!isSmallDevice) {
        closeMobileMenu();
        return;
      }
      var isOpen = navDropdown.classList.contains("open");
      if (isOpen) closeMobileMenu();
      else openMobileMenu();
    });

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (!navDropdown.contains(target) && !navMobileToggle.contains(target)) {
        closeMobileMenu();
      }
    });
  }

  setBodyLoginMode(true);

  var responsive = attachResponsiveMode(bodyEl, function (nextIsSmall) {
    isSmallDevice = nextIsSmall;
    if (!isSmallDevice) closeMobileMenu();
  });
  isSmallDevice = responsive.isSmall();

  /* ---- Image compression helper ---- */

  var COMPRESS_MAX_WIDTH = 600;
  var COMPRESS_QUALITY = 0.45;

  /**
   * Encode a canvas to the smallest data URL by trying WebP and JPEG
   * and picking whichever is smaller. WebP is typically 25-35% smaller
   * than JPEG at the same visual quality.
   */
  function canvasToSmallestDataUrl(canvas, quality) {
    var jpeg = canvas.toDataURL("image/jpeg", quality);

    // Try WebP — not all browsers support WebP canvas export
    var webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp") && webp.length < jpeg.length) {
      return webp;
    }

    return jpeg;
  }

  /**
   * Step-down resize: shrink an image by halving repeatedly until close to
   * the target size, then do one final resize to exact dimensions.
   * This produces much smoother results (acts as anti-aliasing) and the
   * smoother output compresses significantly smaller.
   */
  function stepDownResize(sourceImg, targetW, targetH, quality) {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    var curW = sourceImg.width || sourceImg.naturalWidth;
    var curH = sourceImg.height || sourceImg.naturalHeight;

    // If the source is already at or below target, just draw directly
    if (curW <= targetW * 1.5 && curH <= targetH * 1.5) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(sourceImg, 0, 0, targetW, targetH);
      return canvasToSmallestDataUrl(canvas, quality);
    }

    // Use an offscreen canvas pair for the halving steps
    var stepCanvas = document.createElement("canvas");
    var stepCtx = stepCanvas.getContext("2d");

    // First step: draw original to full-size canvas
    stepCanvas.width = curW;
    stepCanvas.height = curH;
    stepCtx.drawImage(sourceImg, 0, 0, curW, curH);

    // Halve until we are within 1.5x of target
    while (curW > targetW * 1.5 || curH > targetH * 1.5) {
      var halfW = Math.max(Math.round(curW / 2), targetW);
      var halfH = Math.max(Math.round(curH / 2), targetH);

      canvas.width = halfW;
      canvas.height = halfH;
      ctx.drawImage(stepCanvas, 0, 0, curW, curH, 0, 0, halfW, halfH);

      // Swap: copy result back to stepCanvas for next iteration
      stepCanvas.width = halfW;
      stepCanvas.height = halfH;
      stepCtx.drawImage(canvas, 0, 0);

      curW = halfW;
      curH = halfH;
    }

    // Final resize to exact target dimensions
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(stepCanvas, 0, 0, curW, curH, 0, 0, targetW, targetH);

    return canvasToSmallestDataUrl(canvas, quality);
  }

  function compressImage(file, maxWidth, quality) {
    maxWidth = maxWidth || COMPRESS_MAX_WIDTH;
    quality = quality || COMPRESS_QUALITY;

    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;

          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }

          var dataUrl = stepDownResize(img, w, h, quality);
          resolve(dataUrl);
        };
        img.onerror = function () { reject(new Error("Failed to load image")); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error("Failed to read file")); };
      reader.readAsDataURL(file);
    });
  }

  async function compressFiles(files, maxWidth, quality, limit) {
    var results = [];
    var max = limit || 5;
    for (var i = 0; i < Math.min(files.length, max); i++) {
      try {
        var dataUrl = await compressImage(files[i], maxWidth, quality);
        results.push(dataUrl);
      } catch (err) {
        console.error("Image compress error:", err);
      }
    }
    return results;
  }

  /* ---- Re-compress existing data URL images ---- */

  function recompressDataUrl(dataUrl, maxWidth, quality) {
    maxWidth = maxWidth || COMPRESS_MAX_WIDTH;
    quality = quality || COMPRESS_QUALITY;

    return new Promise(function (resolve) {
      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
        resolve(dataUrl);
        return;
      }
      // Skip tiny images (under ~20KB base64) — already small enough
      if (dataUrl.length < 27000) {
        resolve(dataUrl);
        return;
      }

      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;

        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        var newDataUrl = stepDownResize(img, w, h, quality);
        // Only use re-compressed version if it is actually smaller
        resolve(newDataUrl.length < dataUrl.length ? newDataUrl : dataUrl);
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  async function recompressDataUrlArray(arr, maxWidth, quality) {
    if (!Array.isArray(arr) || !arr.length) return arr || [];
    var results = [];
    for (var i = 0; i < arr.length; i++) {
      var compressed = await recompressDataUrl(arr[i], maxWidth, quality);
      results.push(compressed);
    }
    return results;
  }

  async function compressAllSiteImages(statusEl) {
    // 1. Re-compress hero images
    if (homepageState.heroImages && homepageState.heroImages.length) {
      setStatus(statusEl, "Otimizando imagens da página inicial...", "");
      homepageState.heroImages = await recompressDataUrlArray(
        homepageState.heroImages, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY
      );
    }

    // 2. Re-compress about images
    if (homepageState.aboutImages && homepageState.aboutImages.length) {
      setStatus(statusEl, "Otimizando imagens da página sobre nós...", "");
      homepageState.aboutImages = await recompressDataUrlArray(
        homepageState.aboutImages, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY
      );
    }

    // 3. Fetch all products and re-compress their images
    try {
      setStatus(statusEl, "Buscando produtos para otimizar imagens...", "");
      var res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Erro ao buscar produtos");
      var products = await res.json();

      var updatedProducts = [];
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var imgs = p.imageUrls || p.images || [];
        if (!imgs.length) continue;

        setStatus(statusEl, "Otimizando produto " + (i + 1) + " de " + products.length + "...", "");
        var compressed = await recompressDataUrlArray(imgs, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY);

        // Only queue update if something actually changed
        var changed = false;
        for (var j = 0; j < compressed.length; j++) {
          if (compressed[j] !== imgs[j]) { changed = true; break; }
        }

        if (changed) {
          updatedProducts.push({
            id: p.id,
            imageUrl: compressed[0] || "",
            imageUrls: compressed
          });
        }
      }

      // Batch update products with compressed images
      if (updatedProducts.length) {
        setStatus(statusEl, "Salvando " + updatedProducts.length + " produto(s) otimizado(s)...", "");
        var batchRes = await fetch("/api/admin/compress-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: updatedProducts })
        });
        if (!batchRes.ok) {
          throw new Error("Erro ao salvar imagens otimizadas");
        }
      }
    } catch (err) {
      console.error("Error compressing product images:", err);
    }
  }

  /* ---- Theme handling ---- */

  function handleThemeChange(value) {
    homepageState.theme = value || "default";
    applyThemeVariant(homepageState.theme);
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", function () {
      handleThemeChange(themeSelect.value);
    });
  }

  /* ---- Show admin panel after auth ---- */

  function showAdminPanel(welcome) {
    if (loginSection) loginSection.style.display = "none";
    if (loadingSection) {
      loadingSection.style.display = "flex";
      loadingSection.removeAttribute("aria-hidden");
    }
    if (welcomeMessageEl) welcomeMessageEl.textContent = welcome || "Bem-vindo(a)!";

    // Start loading data immediately in background
    loadAdminData();

    setTimeout(function () {
      if (loadingSection) {
        loadingSection.style.display = "none";
        loadingSection.setAttribute("aria-hidden", "true");
      }
      if (panelSection) panelSection.style.display = "block";
      setBodyLoginMode(false);
      buildMobileDropdown();
    }, 4000);
  }

  function showAdminPanelInstant() {
    if (loginSection) loginSection.style.display = "none";
    if (loadingSection) loadingSection.style.display = "none";
    if (panelSection) panelSection.style.display = "block";
    setBodyLoginMode(false);
    loadAdminData();
    buildMobileDropdown();
  }

  /* ---- Login handler ---- */

  async function handleLogin() {
    if (!usernameInput || !passwordInput) return;

    var username = usernameInput.value.trim();
    var password = passwordInput.value;

    if (!username || !password) {
      showLoginError("Preencha usuário e senha.");
      return;
    }

    showLoginError("");
    if (loginButton) loginButton.disabled = true;

    try {
      var res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      });

      var data = await res.json();

      if (!res.ok) {
        showLoginError(data.error || "Erro ao entrar.");
        if (loginButton) loginButton.disabled = false;
        return;
      }

      if (userNameLabel) userNameLabel.textContent = "Danielle";
      showAdminPanel(data.welcome || "Bem vinda, Danielle!");
    } catch (err) {
      console.error("Login error:", err);
      showLoginError("Erro de conexão. Tente novamente.");
      if (loginButton) loginButton.disabled = false;
    }
  }

  if (loginButton) {
    loginButton.addEventListener("click", handleLogin);
  }
  if (passwordInput) {
    passwordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleLogin();
    });
  }
  if (usernameInput) {
    usernameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleLogin();
    });
  }

  /* ---- Logout handler ---- */

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    if (panelSection) panelSection.style.display = "none";
    if (loginSection) loginSection.style.display = "";
    setBodyLoginMode(true);
    if (usernameInput) usernameInput.value = "";
    if (passwordInput) passwordInput.value = "";
    showLoginError("");
    if (loginButton) loginButton.disabled = false;
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  /* ---- Check existing session on page load ---- */

  async function checkSession() {
    try {
      var res = await fetch("/api/admin/session");
      var data = await res.json();
      if (data.authenticated) {
        if (userNameLabel) userNameLabel.textContent = "Danielle";
        showAdminPanelInstant();
      }
    } catch (e) {
      // Not authenticated, stay on login
    }
  }

  checkSession();

  /* ---- Load admin data (homepage + products) ---- */

  async function loadAdminData() {
    await Promise.all([loadHomepageData(), loadProducts()]);
  }

  async function loadHomepageData() {
    try {
      var res = await fetch("/api/homepage", { cache: "no-store" });
      if (!res.ok) return;
      var hp = await res.json();

      homepageState.aboutText = typeof hp.aboutText === "string" ? hp.aboutText : "";
      homepageState.aboutLongText = typeof hp.aboutLongText === "string" ? hp.aboutLongText : "";
      homepageState.heroImages = normalizeList(hp.heroImages || [], MAX_HOMEPAGE_IMAGES);
      homepageState.aboutImages = normalizeList(hp.aboutImages || [], MAX_ABOUT_IMAGES);
      homepageState.notices = Array.isArray(hp.notices) ? hp.notices : [];
      homepageState.theme = typeof hp.theme === "string" ? hp.theme : "default";

      populateHomepageForm();
      populateAboutForm();
      renderNotices();
      applyThemeVariant(homepageState.theme);

      if (themeSelect) themeSelect.value = homepageState.theme;
    } catch (err) {
      console.error("Failed to load homepage data:", err);
    }
  }

  async function loadProducts() {
    try {
      var res = await fetch("/api/admin/products", { cache: "no-store" });
      if (!res.ok) return;
      var data = await res.json();
      allProducts = Array.isArray(data) ? data : [];
      renderAdminProducts();
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }

  /* ---- Populate homepage form ---- */

  function populateHomepageForm() {
    if (aboutTextEl) aboutTextEl.value = homepageState.aboutText || "";
    renderHeroGallery();
  }

  function renderHeroGallery() {
    if (!heroGalleryEl) return;
    heroGalleryEl.innerHTML = "";

    var images = homepageState.heroImages || [];
    if (!images.length) return;

    var frag = document.createDocumentFragment();
    images.forEach(function (src, idx) {
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;";

      var img = document.createElement("img");
      img.src = src;
      img.alt = "Hero " + (idx + 1);
      img.loading = "lazy";
      wrapper.appendChild(img);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "admin-button-ghost";
      removeBtn.textContent = "×";
      removeBtn.style.cssText = "position:absolute;top:4px;right:4px;font-size:14px;background:rgba(0,0,0,0.55);color:#fff;border-radius:50%;width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;z-index:1;";
      removeBtn.addEventListener("click", function () {
        homepageState.heroImages.splice(idx, 1);
        renderHeroGallery();
      });
      wrapper.appendChild(removeBtn);

      frag.appendChild(wrapper);
    });
    heroGalleryEl.appendChild(frag);
  }

  /* ---- Populate about form ---- */

  function populateAboutForm() {
    if (aboutLongTextEl) aboutLongTextEl.value = homepageState.aboutLongText || "";
    renderAboutCollage();
  }

  function renderAboutCollage() {
    if (!aboutCollageEl) return;
    aboutCollageEl.innerHTML = "";

    var images = homepageState.aboutImages || [];

    if (aboutImagePreviewEl && aboutImagePlaceholderEl) {
      if (images.length) {
        aboutImagePreviewEl.src = images[0];
        aboutImagePreviewEl.style.display = "";
        aboutImagePlaceholderEl.style.display = "none";
      } else {
        aboutImagePreviewEl.style.display = "none";
        aboutImagePlaceholderEl.style.display = "";
      }
    }

    if (!images.length) return;

    var frag = document.createDocumentFragment();
    images.forEach(function (src, idx) {
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;";

      var img = document.createElement("img");
      img.src = src;
      img.alt = "About " + (idx + 1);
      img.loading = "lazy";
      wrapper.appendChild(img);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "admin-button-ghost";
      removeBtn.textContent = "×";
      removeBtn.style.cssText = "position:absolute;top:4px;right:4px;font-size:14px;background:rgba(0,0,0,0.55);color:#fff;border-radius:50%;width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;z-index:1;";
      removeBtn.addEventListener("click", function () {
        homepageState.aboutImages.splice(idx, 1);
        renderAboutCollage();
      });
      wrapper.appendChild(removeBtn);

      frag.appendChild(wrapper);
    });
    aboutCollageEl.appendChild(frag);
  }

  /* ---- Hero images file upload ---- */

  if (heroImagesFileButton && heroImagesFileInput) {
    heroImagesFileButton.addEventListener("click", function () {
      heroImagesFileInput.click();
    });

    heroImagesFileInput.addEventListener("change", async function () {
      var files = heroImagesFileInput.files;
      if (!files || !files.length) return;

      setStatus(homepageStatusEl, "Processando imagens...", "");
      try {
        var remaining = MAX_HOMEPAGE_IMAGES - (homepageState.heroImages || []).length;
        var compressed = await compressFiles(files, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY, remaining);
        homepageState.heroImages = (homepageState.heroImages || []).concat(compressed);
        homepageState.heroImages = normalizeList(homepageState.heroImages, MAX_HOMEPAGE_IMAGES);
        renderHeroGallery();
        setStatus(homepageStatusEl, compressed.length + " imagem(ns) adicionada(s).", "ok");
      } catch (err) {
        setStatus(homepageStatusEl, "Erro ao processar imagens.", "error");
      }
      heroImagesFileInput.value = "";
    });
  }

  /* ---- About images file upload ---- */

  if (aboutImagesFileButton && aboutImagesFileInput) {
    aboutImagesFileButton.addEventListener("click", function () {
      aboutImagesFileInput.click();
    });

    aboutImagesFileInput.addEventListener("change", async function () {
      var files = aboutImagesFileInput.files;
      if (!files || !files.length) return;

      setStatus(aboutSaveStatusEl, "Processando imagens...", "");
      try {
        var remaining = MAX_ABOUT_IMAGES - (homepageState.aboutImages || []).length;
        var compressed = await compressFiles(files, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY, remaining);
        homepageState.aboutImages = (homepageState.aboutImages || []).concat(compressed);
        homepageState.aboutImages = normalizeList(homepageState.aboutImages, MAX_ABOUT_IMAGES);
        renderAboutCollage();
        setStatus(aboutSaveStatusEl, compressed.length + " imagem(ns) adicionada(s).", "ok");
      } catch (err) {
        setStatus(aboutSaveStatusEl, "Erro ao processar imagens.", "error");
      }
      aboutImagesFileInput.value = "";
    });
  }

  /* ---- Save homepage ---- */

  if (saveHomepageBtn) {
    saveHomepageBtn.addEventListener("click", async function () {
      saveHomepageBtn.disabled = true;

      try {
        // Compress all site images first (hero, about, and all products)
        await compressAllSiteImages(homepageStatusEl);

        setStatus(homepageStatusEl, "Salvando página inicial...", "");

        var payload = {
          aboutText: aboutTextEl ? aboutTextEl.value : homepageState.aboutText,
          heroImages: homepageState.heroImages || [],
          notices: homepageState.notices || [],
          theme: homepageState.theme || "default"
        };

        var res = await fetch("/api/homepage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          var err = await res.json().catch(function () { return {}; });
          throw new Error(err.error || "Erro ao salvar.");
        }

        homepageState.aboutText = payload.aboutText;
        renderHeroGallery();
        setStatus(homepageStatusEl, "Página inicial salva e imagens otimizadas!", "ok");
      } catch (err) {
        setStatus(homepageStatusEl, err.message || "Erro ao salvar.", "error");
      }

      saveHomepageBtn.disabled = false;
    });
  }

  /* ---- Save about page ---- */

  if (saveAboutPageBtn) {
    saveAboutPageBtn.addEventListener("click", async function () {
      saveAboutPageBtn.disabled = true;

      try {
        // Compress all site images first (hero, about, and all products)
        await compressAllSiteImages(aboutSaveStatusEl);

        setStatus(aboutSaveStatusEl, "Salvando página sobre nós...", "");

        var payload = {
          aboutLongText: aboutLongTextEl ? aboutLongTextEl.value : homepageState.aboutLongText,
          aboutImages: homepageState.aboutImages || []
        };

        var res = await fetch("/api/homepage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          var err = await res.json().catch(function () { return {}; });
          throw new Error(err.error || "Erro ao salvar.");
        }

        homepageState.aboutLongText = payload.aboutLongText;
        renderAboutCollage();
        setStatus(aboutSaveStatusEl, "Página 'Sobre nós' salva e imagens otimizadas!", "ok");
      } catch (err) {
        setStatus(aboutSaveStatusEl, err.message || "Erro ao salvar.", "error");
      }

      saveAboutPageBtn.disabled = false;
    });
  }

  /* ---- Notices management ---- */

  function renderNotices() {
    if (!noticeListEl) return;
    noticeListEl.innerHTML = "";

    var notices = homepageState.notices || [];
    if (!notices.length) return;

    var frag = document.createDocumentFragment();
    notices.forEach(function (text, idx) {
      if (!noticeItemTemplate) return;
      var clone = noticeItemTemplate.content.cloneNode(true);
      var textEl = clone.querySelector(".admin-notice-text");
      if (textEl) textEl.textContent = text;

      var editBtn = clone.querySelector(".admin-notice-edit");
      if (editBtn) {
        editBtn.addEventListener("click", function () {
          var newText = prompt("Editar aviso:", text);
          if (newText !== null && newText.trim()) {
            homepageState.notices[idx] = newText.trim();
            renderNotices();
          }
        });
      }

      var deleteBtn = clone.querySelector(".admin-notice-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", function () {
          homepageState.notices.splice(idx, 1);
          renderNotices();
        });
      }

      frag.appendChild(clone);
    });
    noticeListEl.appendChild(frag);
  }

  if (addNoticeBtn) {
    addNoticeBtn.addEventListener("click", function () {
      var text = prompt("Texto do novo aviso:");
      if (text && text.trim()) {
        if (!Array.isArray(homepageState.notices)) homepageState.notices = [];
        homepageState.notices.push(text.trim());
        renderNotices();
      }
    });
  }

  /* ---- Product rendering in admin grids ---- */

  function renderAdminProducts() {
    Object.keys(grids).forEach(function (cat) {
      var container = grids[cat];
      if (!container) return;
      container.innerHTML = "";

      // Add "new product" card
      if (addCardTemplate) {
        var addClone = addCardTemplate.content.cloneNode(true);
        var addButton = addClone.querySelector(".admin-add-product-button");
        if (addButton) {
          addButton.addEventListener("click", function () {
            openProductModal(null, cat);
          });
        }
        container.appendChild(addClone);
      }

      var items = allProducts.filter(function (p) {
        return p && (p.category === cat);
      });

      items.sort(function (a, b) {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });

      items.forEach(function (p) {
        if (!productCardTemplate) return;
        var clone = productCardTemplate.content.cloneNode(true);
        var card = clone.querySelector(".admin-product-card");
        if (card) card.dataset.productId = p.id || "";

        var img = clone.querySelector(".admin-product-image");
        var imgSrc = p.imageUrl || (Array.isArray(p.imageUrls) && p.imageUrls[0]) || "";
        if (img) {
          img.src = imgSrc || "";
          img.alt = p.name || "";
          if (!imgSrc) img.style.display = "none";
        }

        var title = clone.querySelector(".admin-product-title");
        if (title) title.textContent = p.name || "";

        var desc = clone.querySelector(".admin-product-description");
        if (desc) desc.textContent = p.description || "";

        var price = clone.querySelector(".admin-product-price");
        if (price) price.textContent = formatBRL(p.price);

        var stock = clone.querySelector(".admin-product-stock");
        if (stock) {
          var s = typeof p.stock === "number" ? p.stock : 0;
          stock.textContent = s > 0 ? "Estoque: " + s : "Sem estoque";
        }

        var editBtn = clone.querySelector(".admin-edit-product-button");
        if (editBtn) {
          editBtn.addEventListener("click", function () {
            openProductModal(p, null);
          });
        }

        container.appendChild(clone);
      });
    });
  }

  /* ---- Product modal ---- */

  function openProductModal(product, defaultCategory) {
    currentProductEditing = product || null;
    currentProductImages = [];

    if (productModalTitle) {
      productModalTitle.textContent = product ? "Editar produto" : "Novo produto";
    }

    if (hiddenForm.category) hiddenForm.category.value = product ? (product.category || "specials") : (defaultCategory || "specials");
    if (hiddenForm.name) hiddenForm.name.value = product ? (product.name || "") : "";
    if (hiddenForm.description) hiddenForm.description.value = product ? (product.description || "") : "";
    if (hiddenForm.price) hiddenForm.price.value = product ? (product.price || "") : "";
    if (hiddenForm.originalPrice) hiddenForm.originalPrice.value = product ? (product.originalPrice || "") : "";
    if (hiddenForm.discountLabel) hiddenForm.discountLabel.value = product ? (product.discountLabel || "") : "";
    if (hiddenForm.stock) hiddenForm.stock.value = product ? (product.stock != null ? product.stock : "") : "";

    // Load existing images
    if (product) {
      var imgs = Array.isArray(product.imageUrls) ? product.imageUrls.slice() : [];
      if (product.imageUrl && !imgs.includes(product.imageUrl)) {
        imgs.unshift(product.imageUrl);
      }
      currentProductImages = imgs.slice(0, MAX_PRODUCT_IMAGES);
    }

    renderProductImageThumbs();
    updateProductImagePreview();

    if (productDeleteButton) {
      productDeleteButton.style.display = product ? "" : "none";
    }

    setStatus(hiddenForm.status, "", "");

    if (productModalBackdrop) {
      productModalBackdrop.style.display = "flex";
    }
  }

  function closeProductModal() {
    if (productModalBackdrop) {
      productModalBackdrop.style.display = "none";
    }
    currentProductEditing = null;
    currentProductImages = [];
  }

  if (productModalClose) {
    productModalClose.addEventListener("click", closeProductModal);
  }
  if (productModalBackdrop) {
    productModalBackdrop.addEventListener("click", function (e) {
      if (e.target === productModalBackdrop) closeProductModal();
    });
  }

  function updateProductImagePreview() {
    if (productImagePreview && productImagePlaceholder) {
      if (currentProductImages.length) {
        productImagePreview.src = currentProductImages[0];
        productImagePreview.style.display = "";
        productImagePlaceholder.style.display = "none";
      } else {
        productImagePreview.style.display = "none";
        productImagePlaceholder.style.display = "";
      }
    }
  }

  function renderProductImageThumbs() {
    if (!productImageThumbs) return;
    productImageThumbs.innerHTML = "";

    currentProductImages.forEach(function (src, idx) {
      var thumb = document.createElement("div");
      thumb.className = "admin-image-thumb" + (idx === 0 ? " active" : "");

      var img = document.createElement("img");
      img.src = src;
      img.alt = "Imagem " + (idx + 1);
      thumb.appendChild(img);

      // Click to set as cover
      thumb.addEventListener("click", function () {
        // Move this image to front
        currentProductImages.splice(idx, 1);
        currentProductImages.unshift(src);
        renderProductImageThumbs();
        updateProductImagePreview();
      });

      productImageThumbs.appendChild(thumb);
    });
  }

  /* ---- Product image upload ---- */

  if (productImageFileButton && hiddenForm.imageFile) {
    productImageFileButton.addEventListener("click", function () {
      hiddenForm.imageFile.click();
    });

    hiddenForm.imageFile.addEventListener("change", async function () {
      var files = hiddenForm.imageFile.files;
      if (!files || !files.length) return;

      setStatus(hiddenForm.status, "Processando imagens...", "");
      try {
        var remaining = MAX_PRODUCT_IMAGES - currentProductImages.length;
        var compressed = await compressFiles(files, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY, remaining);
        currentProductImages = currentProductImages.concat(compressed);
        currentProductImages = currentProductImages.slice(0, MAX_PRODUCT_IMAGES);
        renderProductImageThumbs();
        updateProductImagePreview();
        setStatus(hiddenForm.status, "", "");
      } catch (err) {
        setStatus(hiddenForm.status, "Erro ao processar imagens.", "error");
      }
      hiddenForm.imageFile.value = "";
    });
  }

  /* ---- Product form submit (create or update) ---- */

  if (hiddenForm.el) {
    hiddenForm.el.addEventListener("submit", async function (e) {
      e.preventDefault();

      var category = hiddenForm.category ? hiddenForm.category.value : "";
      var name = hiddenForm.name ? hiddenForm.name.value.trim() : "";
      var description = hiddenForm.description ? hiddenForm.description.value.trim() : "";
      var price = hiddenForm.price ? parseFloat(hiddenForm.price.value) : 0;
      var stock = hiddenForm.stock ? parseInt(hiddenForm.stock.value, 10) : 0;

      var originalPriceRaw = hiddenForm.originalPrice ? hiddenForm.originalPrice.value.trim() : "";
      var originalPrice = originalPriceRaw ? parseFloat(originalPriceRaw) : null;
      var discountLabel = hiddenForm.discountLabel ? hiddenForm.discountLabel.value.trim() : "";

      if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
        setStatus(hiddenForm.status, "Preencha pelo menos nome, preço e estoque.", "error");
        return;
      }

      var imageUrls = currentProductImages.slice();
      var imageUrl = imageUrls[0] || "";

      var payload = {
        category: category,
        name: name,
        description: description,
        price: price,
        stock: stock,
        imageUrl: imageUrl,
        imageUrls: imageUrls,
        originalPrice: originalPrice,
        discountLabel: discountLabel
      };

      setStatus(hiddenForm.status, "Salvando...", "");

      try {
        var url = currentProductEditing
          ? "/api/products/" + currentProductEditing.id
          : "/api/products";
        var method = currentProductEditing ? "PUT" : "POST";

        var res = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          var errData = await res.json().catch(function () { return {}; });
          throw new Error(errData.error || "Erro ao salvar produto.");
        }

        setStatus(hiddenForm.status, "Produto salvo!", "ok");
        closeProductModal();
        await loadProducts();
      } catch (err) {
        setStatus(hiddenForm.status, err.message || "Erro ao salvar produto.", "error");
      }
    });
  }

  /* ---- Product delete ---- */

  if (productDeleteButton) {
    productDeleteButton.addEventListener("click", async function () {
      if (!currentProductEditing) return;

      var confirmed = confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.");
      if (!confirmed) return;

      setStatus(hiddenForm.status, "Excluindo...", "");

      try {
        var res = await fetch("/api/products/" + currentProductEditing.id, {
          method: "DELETE"
        });

        if (!res.ok) {
          var errData = await res.json().catch(function () { return {}; });
          throw new Error(errData.error || "Erro ao excluir produto.");
        }

        closeProductModal();
        await loadProducts();
      } catch (err) {
        setStatus(hiddenForm.status, err.message || "Erro ao excluir.", "error");
      }
    });
  }

  /* ---- Initial view ---- */
  switchView("home");
}
