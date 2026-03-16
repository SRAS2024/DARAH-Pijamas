# DARAH Pijamas

**Live site: [darahpijamas.com](https://darahpijamas.com)**

DARAH Pijamas is a modern e-commerce storefront for elegant and comfortable sleepwear, built for the Brazilian market. It features a beautiful single-page storefront, a full-featured admin panel, and a seamless WhatsApp-based checkout flow — no payment gateway needed.

---

## Features

### Storefront

- **Single-page navigation** with smooth category views: Babydoll, Camisolas, Longos, and Infantil
- **Product browsing** with multi-image galleries (up to 5 images per product), lazy-loaded for performance
- **Per-visitor cart sessions** — every visitor gets a private server-side cart via secure httpOnly cookies
- **Streamlined checkout** with subtotal summary and one-click WhatsApp order completion
- **Discount labels** with strikethrough original pricing and stock availability checks
- **Site-wide announcements** and customizable notices
- **Seasonal theme variants**: Default Sage, Christmas Red/Gold, and Easter Blue/Gold
- **Responsive design** that works cleanly on mobile and desktop
- **Hero image carousel** with up to 12 admin-uploadable images
- **About page** with customizable text and image collages (up to 4 images)
- **SEO support** with auto-generated `robots.txt` and `sitemap.xml`
- **PWA manifest** for home-screen installation on mobile devices

### Admin Panel

- **Authenticated dashboard** at `/admin`
- **Product management**: create, edit, and delete products with multi-image uploads (up to 5 per product)
- **Homepage editor**: hero images (up to 12), about text, notices, and theme selection
- **About page customization** with image collages (up to 4 images)
- **Stock and pricing management** including discount tracking
- **Theme switcher** for seasonal branding
- **Logo management**: upload a custom site logo/favicon
- **Batch image compression** to optimize stored product images
- **Product debug view** with category counts and diagnostics

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Back end** | Node.js, Express | REST API with gzip compression |
| **Front end** | Vanilla JavaScript, HTML5, CSS3 | No frameworks — lightweight and fast |
| **Database** | PostgreSQL | Falls back to in-memory store if `DATABASE_URL` is not set |
| **Sessions** | express-session | Secure httpOnly cookies for visitor cart tracking |
| **Deployment** | Railway | Production-ready with PostgreSQL integration |

---

## Project Structure

```
DARAH-Pijamas/
├── server.js                          # Express API server and session handling
├── db.js                              # PostgreSQL persistence layer
├── package.json                       # Dependencies and scripts
├── LICENSE                            # Apache 2.0
└── client/
    ├── index.html                     # Storefront UI (single-page app)
    ├── admin.html                     # Admin panel UI
    ├── main.js                        # Shared client script (auto-detects storefront vs admin)
    ├── styles.css                     # CSS variable-based theming and responsive styles
    ├── favicon.svg                    # SVG favicon
    ├── favicon-32x32.png              # PNG favicon
    ├── apple-touch-icon.png           # Apple touch icon
    ├── site.webmanifest               # PWA manifest
    └── google0292583cfdf40074.html    # Google Search Console verification
```

---

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/homepage` | Homepage content, hero images, notices, and theme |
| `GET` | `/api/products` | All active products grouped by category |
| `GET` | `/api/logo` | Current site logo |
| `GET` | `/api/cart` | Current visitor's cart contents |
| `POST` | `/api/cart/add` | Add a product to the cart |
| `POST` | `/api/cart/update` | Update cart item quantity |
| `POST` | `/api/checkout-link` | Generate a WhatsApp checkout link with order summary |

### Admin Endpoints (authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Authenticate as admin |
| `POST` | `/api/admin/logout` | End admin session |
| `GET` | `/api/admin/session` | Check current admin session status |
| `GET` | `/api/admin/products` | All products including inactive ones |
| `GET` | `/api/admin/debug/products` | Product diagnostics and category counts |
| `PUT` | `/api/homepage` | Update homepage content, images, and theme |
| `POST` | `/api/products` | Create a new product |
| `PUT` | `/api/products/:id` | Update an existing product |
| `DELETE` | `/api/products/:id` | Delete a product |
| `PUT` | `/api/admin/logo` | Upload a custom site logo |
| `POST` | `/api/admin/compress-images` | Batch-compress stored product images |

### SEO and Meta Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/robots.txt` | Auto-generated robots file |
| `GET` | `/sitemap.xml` | Auto-generated XML sitemap |
| `GET` | `/site.webmanifest` | PWA manifest |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [PostgreSQL](https://www.postgresql.org/) (optional — the app falls back to an in-memory store for development)

### Installation

```bash
git clone https://github.com/SRAS2024/DARAH-Pijamas.git
cd DARAH-Pijamas
npm install
```

### Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | No | Falls back to in-memory |
| `SESSION_SECRET` | Secret for signing session cookies | No | `darah-dev-secret` |
| `PORT` | Server port | No | `5000` |
| `ADMIN_USERNAME` | Admin login username | No | `admin` |
| `ADMIN_PASSWORD` | Admin login password | No | `admin` |
| `SITE_URL` | Base URL for sitemap and robots.txt | No | `https://darahpijamas.com` |
| `STATIC_DIR` | Custom path to the client directory | No | Auto-detected |

### Running

```bash
npm start          # Production mode
npm run dev        # Development mode with auto-reload (nodemon)
```

The storefront will be available at `http://localhost:5000` and the admin panel at `http://localhost:5000/admin`.

---

## How Checkout Works

DARAH Pijamas uses a **WhatsApp-based checkout flow** instead of a traditional payment gateway:

1. Customers browse products and add items to their session-based cart
2. At checkout, they review the order summary (subtotal and total)
3. Clicking "Finalizar pedido" generates a pre-formatted WhatsApp message with the full order details
4. The customer is redirected to WhatsApp to send the order directly to the store owner

This approach is ideal for small Brazilian businesses that prefer direct customer communication and flexible payment arrangements.

---

## Themes

DARAH supports seasonal theme variants that can be switched from the admin panel:

| Theme | Colors | Use Case |
|-------|--------|----------|
| **Default (Sage)** | Soft greens and neutrals | Year-round |
| **Christmas** | Red and Gold | Holiday season |
| **Easter** | Blue and Gold | Easter season |

Themes are applied via CSS custom properties, making it easy to add new variants.

---

## Deployment

DARAH is designed for [Railway](https://railway.app/) deployment:

1. Connect your GitHub repository to Railway
2. Add a PostgreSQL plugin
3. Set the `DATABASE_URL` environment variable (Railway does this automatically)
4. Deploy — the app will start serving on the assigned port

The app also works on any Node.js hosting platform that supports PostgreSQL.

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
