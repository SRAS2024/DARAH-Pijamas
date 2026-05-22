# DARAH Pijamas

**A modern e-commerce storefront for elegant, comfortable sleepwear — built for the Brazilian market, with a full admin panel and a frictionless WhatsApp checkout (no payment gateway required).**

> ### ✅ Proven functional — run, tested and documented end to end
>
> This repository does not just *describe* the project: it **proves it works**.
> The application was installed, started against a real **temporary PostgreSQL
> database**, seeded with **20 realistic pajama products in Brazilian Portuguese**,
> and every major feature was exercised in a real browser. The walkthrough below,
> the **34 screenshots**, the recorded video and the database captures in
> [`docs/`](docs/) are all genuine output from that live run.

---

## 🎬 Full walkthrough

A complete shopping journey — scrolling collections, adding products to the cart,
reviewing the order and completing the **WhatsApp checkout**:

![DARAH Pijamas walkthrough](docs/darah-walkthrough.gif)

> 📹 Full-resolution screen recording: [`docs/darah-walkthrough.webm`](docs/darah-walkthrough.webm)
> · the same flow is also documented frame-by-frame in [section 3](#3-whatsapp-checkout-flow--step-by-step).

---

## Table of contents

1. [Proof of functionality — how this was verified](#1-proof-of-functionality--how-this-was-verified)
2. [The storefront (public site)](#2-the-storefront-public-site)
3. [WhatsApp checkout flow — step by step](#3-whatsapp-checkout-flow--step-by-step)
4. [The admin panel](#4-the-admin-panel)
5. [Responsive / mobile experience](#5-responsive--mobile-experience)
6. [Database — structure, diagram and records](#6-database--structure-diagram-and-records)
7. [Features](#7-features)
8. [Tech stack](#8-tech-stack)
9. [Project structure](#9-project-structure)
10. [API reference](#10-api-reference)
11. [Running locally / reproducing this demo](#11-running-locally--reproducing-this-demo)
12. [How checkout works](#12-how-checkout-works)
13. [Deployment](#13-deployment)
14. [License](#14-license)

---

## 1. Proof of functionality — how this was verified

The app was started exactly as it would run in production, with a dedicated
**temporary PostgreSQL database** and **temporary admin credentials**. The
server connected to PostgreSQL, created its schema automatically, and served
the storefront and admin panel.

### Demo environment

| Item | Value |
|------|-------|
| Runtime | Node.js v22 · Express 4 |
| Database | PostgreSQL 16 — database `darah_demo`, owner role `darah_admin` *(temporary)* |
| Connection | `DATABASE_URL=postgres://darah_admin:***@127.0.0.1:5432/darah_demo` |
| Storefront URL | `http://localhost:5000/` |
| Admin URL | `http://localhost:5000/admin` |
| Temporary admin user | `darah.demo` |
| Temporary admin password | `Darah@Demo2026` |
| Catalogue seeded | **20 products** — 5 Babydoll · 5 Camisolas · 5 Longos · 5 Infantil |
| Homepage content | About text, 3 hero images, 3 notices, brand logo |
| About page content | Long story text + 4-image collage |
| Analytics seeded | ~710 visits · ~845 product views · 165 cart events (30-day spread) |

> ⚠️ The database name, role, password and admin credentials above are
> **throw-away values created only for this proof run**. They are not
> production secrets. Configure your own via environment variables
> (see [section 11](#11-running-locally--reproducing-this-demo)).

### Server boot — connected to PostgreSQL

```
[DARAH] Serving static files from: /home/user/DARAH-Pijamas/client
[DARAH] Database initialized and in memory cache hydrated.
[DARAH] Products loaded: 0
[DARAH] Pre-generated cached HTML for instant loading.
[DARAH] API rodando na porta 5000
[DARAH] Storefront: http://localhost:5000/
[DARAH] Admin: http://localhost:5000/admin
```

After seeding, the live API confirms the catalogue and homepage content:

```
GET /api/products   ->  babydoll: 5 · camisolas: 5 · longos: 5 · infantil: 5
GET /api/homepage   ->  aboutText 242 chars · aboutLongText 697 chars
                        heroImages 3 · aboutImages 4 · notices 3 · theme default
```

### Verification checklist

Every major feature was exercised in a real Chromium browser. Each row links to
the screenshot that proves it.

| Area | Feature | Status | Evidence |
|------|---------|:------:|----------|
| Storefront | Homepage (hero, notices, about block) | ✅ | [§2.1](#21-homepage) |
| Storefront | About page (story + collage) | ✅ | [§2.2](#22-about-page) |
| Storefront | Product browsing — 4 collections | ✅ | [§2.3](#23-product-collections) |
| Storefront | Multi-image carousel per product | ✅ | [§2.4](#24-product-images--carousel--lightbox) |
| Storefront | Full-screen image lightbox | ✅ | [§2.4](#24-product-images--carousel--lightbox) |
| Storefront | Discount labels + strikethrough pricing | ✅ | [§2.3](#23-product-collections) |
| Storefront | Out-of-stock handling | ✅ | [§2.3](#23-product-collections) |
| Cart | Add to cart + live cart badge | ✅ | [§3](#3-whatsapp-checkout-flow--step-by-step) |
| Cart | Order review, quantity update, totals | ✅ | [§2.5](#25-cart--order-review) |
| Checkout | WhatsApp link generation + order message | ✅ | [§3](#3-whatsapp-checkout-flow--step-by-step) |
| Admin | Authenticated login | ✅ | [§4.1](#41-login) |
| Admin | Homepage / hero / notices / logo editor | ✅ | [§4.3](#43-dashboard--homepage-editor) |
| Admin | Product create (with image upload) | ✅ | [§4.5](#45-create-a-product-with-image-upload) |
| Admin | Product edit | ✅ | [§4.6](#46-edit-a-product) |
| Admin | Product delete | ✅ | [§4.7](#47-delete-a-product) |
| Admin | About page editor | ✅ | [§4.8](#48-about-page-editor) |
| Admin | Insights / analytics dashboard | ✅ | [§4.9](#49-insights--analytics) |
| Platform | Responsive / mobile layout | ✅ | [§5](#5-responsive--mobile-experience) |
| Platform | PostgreSQL persistence | ✅ | [§6](#6-database--structure-diagram-and-records) |

---

## 2. The storefront (public site)

The storefront is a single-page application (vanilla JavaScript) with smooth
in-page navigation between the home, about and four product collections.

### 2.1 Homepage

The homepage shows the site **notices** (`Avisos`), the **hero image gallery**,
the **"Sobre a DARAH Pijamas"** brand block and a featured-selection callout —
all populated from the database and editable from the admin panel.

![Homepage](docs/screenshots/01-homepage.png)

### 2.2 About page

The **"Sobre nós"** page renders the long brand story (multi-paragraph,
Brazilian Portuguese) alongside a four-image collage.

![About page](docs/screenshots/02-about.png)

### 2.3 Product collections

Products are grouped into four collections. Each card shows the product image
(or image carousel), name, description, price, stock and an *Adicionar ao
carrinho* button. Cards with a promotion show the **original price struck
through** plus a **discount label**; out-of-stock items show *Sem estoque* and
a disabled button.

**Babydoll** — 5 products, including discounts (`25% OFF`, `Oferta especial`)
and one out-of-stock item:

![Babydoll collection](docs/screenshots/03-babydoll.png)

**Camisolas** — 5 nightgown products:

![Camisolas collection](docs/screenshots/04-camisolas.png)

**Longos** — 5 long pajama sets:

![Longos collection](docs/screenshots/05-longos.png)

**Infantil** — 5 children's pajamas:

![Infantil collection](docs/screenshots/06-infantil.png)

### 2.4 Product images — carousel & lightbox

Products with more than one image expose an in-card **carousel** (arrows + a
`2/3` position indicator). Clicking any product image opens a full-screen
**lightbox** with keyboard and arrow navigation.

| In-card carousel | Full-screen lightbox |
|---|---|
| ![Product carousel](docs/screenshots/07-product-carousel.png) | ![Lightbox](docs/screenshots/08-lightbox.png) |

### 2.5 Cart & order review

The cart view (`Finalizar pedido`) lists every item with its image, unit price
and line total, quantity steppers, and a live **Resumo** panel with subtotal
and total. Quantities update instantly and the totals recalculate.

| Cart with 4 items | After increasing a quantity |
|---|---|
| ![Cart](docs/screenshots/09-cart.png) | ![Cart updated](docs/screenshots/10-cart-updated.png) |

The cart is persisted per visitor in `localStorage` (with a compact fallback
encoding) and mirrored to a server-side session, so it survives reloads.

---

## 3. WhatsApp checkout flow — step by step

DARAH replaces the traditional payment gateway with a **WhatsApp checkout**:
the cart is converted into a pre-formatted order message and the customer is
sent straight to a WhatsApp conversation with the store. Below is the complete
flow, captured frame by frame.

**Step 1 — Browse a collection.** The customer explores a category.

![Step 1 — browsing](docs/screenshots/flow-1-navegar-produtos.png)

**Step 2 — Add products to the cart.** Each *Adicionar ao carrinho* click
updates the cart badge in the header (it shows `4` here).

![Step 2 — items added](docs/screenshots/flow-2-adicionar-ao-carrinho.png)

**Step 3 — Review the order.** The cart shows every item, quantities and totals.

![Step 3 — review cart](docs/screenshots/flow-3-revisar-carrinho.png)

**Step 4 — Finalise.** Clicking *Finalizar pedido* calls `POST /api/checkout-link`,
which builds the order message and returns a `wa.me` deep link.

![Step 4 — finalise](docs/screenshots/flow-4-finalizar-pedido.png)

**The actual link generated by the running server:**

```
https://wa.me/5565999883400?text=Ol%C3%A1%2C%20eu%20gostaria%20de%20fazer%20um%20pedido...
```

Decoded, the order message reads:

```
Olá, eu gostaria de fazer um pedido dos seguintes itens:

1. Babydoll Cetim Aurora
   2 x R$ 99,90 = R$ 199,80
2. Camisola Lua de Seda
   1 x R$ 149,90 = R$ 149,90
3. Pijama Infantil Estrelinhas
   1 x R$ 64,90 = R$ 64,90

*Total: R$ 414,60*
```

**Step 5 — Order delivered to WhatsApp.** The deep link opens WhatsApp with the
order text already pasted into the chat with the store, ready to send. (`*…*`
is WhatsApp bold syntax, so the total renders in bold.)

<p align="center">
  <img src="docs/screenshots/flow-5-pedido-no-whatsapp.png" width="380" alt="Order pasted into WhatsApp" />
</p>

The line totals and grand total in the message are computed server-side and
match the cart exactly (`2 × 99,90 + 149,90 + 64,90 = 414,60`).

---

## 4. The admin panel

The admin panel lives at `/admin`, behind an authenticated session. It mirrors
the storefront's look and lets the shop owner manage everything.

### 4.1 Login

A clean login screen — credentials are validated against `ADMIN_USERNAME` /
`ADMIN_PASSWORD`.

![Admin login](docs/screenshots/20-admin-login.png)

### 4.2 Welcome screen

On a successful login a branded welcome loader is shown while the panel data
loads in the background.

![Admin welcome](docs/screenshots/21-admin-welcome.png)

### 4.3 Dashboard / homepage editor

The admin home tab is the **homepage editor**: the hero image gallery, the
brand text, the site notices (add / edit / delete) and the **site logo
uploader**. The logo uploaded here is also served as the site favicon.

![Admin dashboard](docs/screenshots/22-admin-home.png)

### 4.4 Product management

Each collection tab shows an admin product grid: every product card plus a
dashed **"Adicionar novo produto"** card. Cards also surface per-product
analytics (views and cart-adds).

![Admin product grid](docs/screenshots/23-admin-products.png)

### 4.5 Create a product (with image upload)

Creating a product was tested live: the form was filled in, an image file was
**uploaded from disk** (the client compresses it in-browser before saving),
price/discount/stock were set, and the product was saved.

![New product modal](docs/screenshots/24-admin-product-new.png)

After saving, the new product (**"Babydoll Pétala Encantada"**) appears
immediately in the grid and is persisted to PostgreSQL:

![Product created](docs/screenshots/25-admin-product-created.png)

### 4.6 Edit a product

Opening any product loads its full data (category, name, description, all
images, price, original price, discount label, stock) into the editor.

![Edit product modal](docs/screenshots/26-admin-product-edit.png)

### 4.7 Delete a product

The test product created in §4.5 was then **deleted** through the admin UI
(with a confirmation prompt). The grid returns to the original 20-product
catalogue, confirming the delete reached the database:

![Grid after delete](docs/screenshots/27-admin-products-after-delete.png)

### 4.8 About page editor

The "Sobre nós" editor controls the long brand story text and the about-page
image collage (each image removable individually).

![Admin about editor](docs/screenshots/28-admin-about.png)

### 4.9 Insights / analytics

The **Análises** dashboard renders a daily-visits bar chart, a total-visits
counter, and a **traffic-source breakdown** (Instagram, direct, Google,
Facebook, WhatsApp, TikTok) computed from the `visits` table.

![Admin insights](docs/screenshots/29-admin-insights.png)

---

## 5. Responsive / mobile experience

The same storefront adapts to small screens: the navigation collapses into a
hamburger menu and grids reflow to a single column.

| Home (mobile) | Hamburger menu | Cart (mobile) |
|---|---|---|
| <img src="docs/screenshots/40-mobile-home.png" width="240" alt="Mobile home" /> | <img src="docs/screenshots/41-mobile-menu.png" width="240" alt="Mobile menu" /> | <img src="docs/screenshots/43-mobile-carrinho.png" width="240" alt="Mobile cart" /> |

Product collections on mobile:

<p align="center">
  <img src="docs/screenshots/42-mobile-camisolas.png" width="280" alt="Mobile collection" />
</p>

---

## 6. Database — structure, diagram and records

The app persists everything to **PostgreSQL**. On startup it creates the schema
automatically (`CREATE TABLE IF NOT EXISTS …`) and hydrates an in-memory cache
from it. All five tables shown below were created by the running app.

### 6.1 Entity-relationship diagram

![Database ER diagram](docs/screenshots/db-erd.png)

> Vector version: [`docs/database-er-diagram.svg`](docs/database-er-diagram.svg)

The model has five tables:

- **`homepage`** — a singleton row (`CHECK id = 1`) holding all editable site
  content: about texts, hero/about images, notices, theme and logo.
- **`products`** — the catalogue. `image_urls` is a `jsonb` array (up to 5
  images per product); promotions use `original_price` + `discount_label`.
- **`visits`** — one row per tracked page visit, with `referrer` for the
  traffic-source analytics.
- **`product_views`** — one row per product impression; `product_id`
  logically references `products.id`.
- **`cart_events`** — one row per add-to-cart; `product_id` logically
  references `products.id`.

`product_views` and `cart_events` hold a **many-to-one** relationship to
`products` (one product → many views / cart events). `homepage` and `visits`
are standalone.

### 6.2 Tables in the database

The five tables created by the app, plus live row counts:

![Database tables](docs/screenshots/db-1-tables.png)

### 6.3 Schema — content tables

`\d products` and `\d homepage` — column types, defaults, constraints and
indexes:

![products & homepage schema](docs/screenshots/db-2-schema.png)

### 6.4 Schema — analytics tables

`\d visits`, `\d product_views` and `\d cart_events`, including their indexes:

![analytics schema](docs/screenshots/db-3-analytics-schema.png)

### 6.5 Sample records

Real rows from the seeded database — the full 20-product catalogue, the
`homepage` singleton, recent visits, top product views and cart-event totals:

![Sample records](docs/screenshots/db-4-records.png)

---

## 7. Features

### Storefront

- **Single-page navigation** across Home, Sobre nós and four collections —
  Babydoll, Camisolas, Longos and Infantil.
- **Multi-image products** (up to 5 images each) with an in-card carousel and a
  full-screen lightbox; images are lazy-loaded for performance.
- **Per-visitor cart** persisted in `localStorage` and mirrored to a
  server-side session via a secure `httpOnly` cookie.
- **Order review** with quantity steppers, live subtotal/total and a one-click
  **WhatsApp checkout**.
- **Promotions** — original price struck through plus a custom discount label.
- **Stock awareness** — out-of-stock products are clearly flagged.
- **Site notices / announcements**, editable from the admin panel.
- **Responsive design** for mobile and desktop.
- **Hero image gallery** (up to 12 admin-uploaded images) and an **about-page
  collage** (up to 4 images).
- **SEO** — auto-generated `robots.txt` and `sitemap.xml`, plus a PWA manifest.
- **Dynamic favicon** served from the admin-uploaded logo.

### Admin panel

- **Authenticated dashboard** at `/admin`.
- **Product management** — create, edit and delete products with multi-image
  uploads (compressed in-browser before saving).
- **Homepage editor** — hero images, brand text, notices and logo.
- **About page editor** — long story text and image collage.
- **Pricing & stock** management, including discount tracking.
- **Insights dashboard** — visit statistics, traffic-source breakdown and
  per-product view / cart-add counts.
- **Batch image optimization** — re-compresses stored images on save.

---

## 8. Tech stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Back end | Node.js, Express | REST API with gzip compression |
| Front end | Vanilla JavaScript, HTML5, CSS3 | No frameworks — lightweight and fast |
| Database | PostgreSQL | Falls back to an in-memory store if `DATABASE_URL` is unset |
| Sessions | express-session | Secure `httpOnly` cookies for visitor/cart tracking |
| Deployment | Railway-ready | Works on any Node.js host with PostgreSQL |

---

## 9. Project structure

```
DARAH-Pijamas/
├── server.js                 # Express API server and session handling
├── db.js                     # PostgreSQL persistence layer
├── package.json              # Dependencies and scripts
├── LICENSE                   # Apache 2.0
├── client/
│   ├── index.html            # Storefront UI (single-page app)
│   ├── admin.html            # Admin panel UI
│   ├── main.js               # Shared client script (storefront + admin)
│   ├── styles.css            # CSS-variable theming and responsive styles
│   ├── favicon.svg / *.png   # Icons
│   └── site.webmanifest      # PWA manifest
└── docs/                     # Proof of functionality (this README's evidence)
    ├── darah-walkthrough.gif # Inline walkthrough animation
    ├── darah-walkthrough.webm# Full-resolution screen recording
    ├── database-er-diagram.svg
    ├── screenshots/          # 34 captures of every page and flow
    └── demo-tooling/         # Scripts used to seed and capture this demo
```

---

## 10. API reference

### Public endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/homepage` | Homepage content, hero images, notices, theme |
| `GET` | `/api/products` | Active products grouped by category |
| `GET` | `/api/logo` | Current site logo |
| `GET` | `/api/cart` | Current visitor's cart |
| `POST` | `/api/cart/add` | Add a product to the cart |
| `POST` | `/api/cart/update` | Update a cart item quantity |
| `POST` | `/api/checkout-link` | Generate a WhatsApp checkout link |
| `POST` | `/api/track/visit` | Record a page visit |
| `POST` | `/api/track/product-view` | Record a product view |

### Admin endpoints (authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Authenticate as admin |
| `POST` | `/api/admin/logout` | End the admin session |
| `GET` | `/api/admin/session` | Check admin session status |
| `GET` | `/api/admin/products` | All products (including inactive) |
| `GET` | `/api/admin/debug/products` | Product diagnostics / category counts |
| `PUT` | `/api/homepage` | Update homepage content, images, theme |
| `POST` | `/api/products` | Create a product |
| `PUT` | `/api/products/:id` | Update a product |
| `DELETE` | `/api/products/:id` | Delete a product |
| `PUT` | `/api/admin/logo` | Upload a custom site logo |
| `POST` | `/api/admin/compress-images` | Batch-persist compressed product images |
| `GET` | `/api/admin/insights/visits` | Visit counts by day |
| `GET` | `/api/admin/insights/visitors` | Referrer-source breakdown |
| `GET` | `/api/admin/insights/product-stats` | Per-product view / cart-add counts |

### SEO & meta

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/robots.txt` | Auto-generated robots file |
| `GET` | `/sitemap.xml` | Auto-generated XML sitemap |
| `GET` | `/site.webmanifest` | PWA manifest |

---

## 11. Running locally / reproducing this demo

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (v22 used for this proof)
- [PostgreSQL](https://www.postgresql.org/) 14+ (optional — the app falls back
  to an in-memory store when `DATABASE_URL` is unset)

### Install

```bash
git clone https://github.com/SRAS2024/DARAH-Pijamas.git
cd DARAH-Pijamas
npm install
```

### Create a database (the exact steps used for this proof)

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE darah_admin WITH LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE darah_demo OWNER darah_admin;
SQL
```

### Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | *(in-memory fallback)* |
| `SESSION_SECRET` | Secret for signing session cookies | `darah-dev-secret` |
| `PORT` | Server port | `5000` |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | `admin` |
| `SITE_URL` | Base URL for `sitemap.xml` / `robots.txt` | `https://darahpijamas.com` |
| `STATIC_DIR` | Custom path to the `client` directory | auto-detected |

### Run

```bash
export DATABASE_URL="postgres://darah_admin:choose-a-password@127.0.0.1:5432/darah_demo"
export ADMIN_USERNAME="darah.demo"
export ADMIN_PASSWORD="Darah@Demo2026"
npm start
```

The storefront is then at `http://localhost:5000/` and the admin panel at
`http://localhost:5000/admin`.

### Reproducing the demo content

The exact scripts used to generate this demo — the SVG illustration generator,
the 20-product Brazilian-Portuguese catalogue seeder, the analytics seeder and
the browser-capture tooling — are committed under
[`docs/demo-tooling/`](docs/demo-tooling/) with their own README.

---

## 12. How checkout works

DARAH Pijamas uses a **WhatsApp-based checkout** instead of a payment gateway:

1. Customers browse products and add items to their session-based cart.
2. At checkout they review the order summary (subtotal and total).
3. Clicking **"Finalizar pedido"** calls `POST /api/checkout-link`, which builds
   a pre-formatted WhatsApp message with the full order and returns a `wa.me`
   deep link.
4. The customer is taken to WhatsApp with the order ready to send to the store.

This is ideal for small Brazilian businesses that prefer direct customer
contact and flexible payment arrangements. See [section 3](#3-whatsapp-checkout-flow--step-by-step)
for the proven, end-to-end flow.

---

## 13. Deployment

DARAH is ready for [Railway](https://railway.app/):

1. Connect your GitHub repository to Railway.
2. Add a PostgreSQL plugin.
3. `DATABASE_URL` is provided automatically; set `ADMIN_USERNAME`,
   `ADMIN_PASSWORD` and `SESSION_SECRET`.
4. Deploy — the server starts on the assigned port and creates its schema on
   first boot.

The app also runs on any Node.js host with access to PostgreSQL.

---

## 14. License

Apache 2.0 — see [LICENSE](LICENSE) for details.
