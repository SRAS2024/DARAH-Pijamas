# DARAH · Boutique Jewelry Storefront

**Live site:** [https://darahjoias.com](https://darahjoias.com)

DARAH is a modern jewelry e-commerce storefront with a built-in admin panel and fully functional checkout flow, crafted for small brands that want something elegant, focused, and fast. Built for the Brazilian market with BRL pricing and Portuguese language support.

## Features

### Storefront
- Single-page storefront with category views: Special Offers, Sets, Rings, Necklaces, Bracelets, and Earrings
- Product browsing with multi-image galleries (up to 5 images per product)
- Per-visitor cart sessions on the server so every visitor keeps a private cart
- Full checkout flow with subtotal and tax calculation, completing orders via WhatsApp
- Discount labels and strikethrough original pricing
- Customizable site-wide announcements and notices
- Seasonal theme variants (Default Sage, Christmas Red/Gold, Easter Blue/Gold)
- Responsive layout that works cleanly on mobile and desktop

### Admin Panel
- Authenticated admin dashboard at `/admin.html`
- Product management: create, edit, and delete products with multi-image uploads
- Homepage editor: upload hero images (up to 12), edit about text, manage notices
- About page customization with image collages (up to 4 images)
- Stock and pricing management including discount tracking
- Theme selection interface

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Back end | Node.js, Express, compression |
| Front end | Vanilla JavaScript, HTML5, CSS3 |
| Database | PostgreSQL (falls back to in-memory if unavailable) |
| Sessions | `express-session` with httpOnly cookies |
| Deployment | Railway |

## Project Structure

```
DARAH/
├── server.js              # Express API and session handling
├── db.js                  # PostgreSQL persistence layer
├── package.json
├── LICENSE
└── client/
    ├── index.html         # Storefront UI
    ├── admin.html         # Admin panel UI
    ├── main.js            # Shared client script (auto-detects page context)
    ├── styles.css         # Styling with CSS variable theming
    ├── favicon.svg        # Browser favicon
    ├── favicon-32x32.png
    ├── apple-touch-icon.png
    └── site.webmanifest   # PWA manifest
```

## API Overview

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/homepage` | Homepage content, images, notices, theme |
| GET | `/api/products` | All products grouped by category |
| GET | `/api/cart` | Current visitor's cart |
| POST | `/api/cart/add` | Add a product to the cart |
| POST | `/api/cart/update` | Update cart item quantity |
| POST | `/api/checkout-link` | Generate a WhatsApp checkout link |

### Admin (authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Authenticate as admin |
| POST | `/api/admin/logout` | End admin session |
| GET | `/api/admin/session` | Check current admin session |
| PUT | `/api/homepage` | Update homepage content |
| GET | `/api/admin/products` | All products including inactive |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |

## Getting Started

```bash
git clone https://github.com/SRAS2024/DARAH.git
cd DARAH
npm install
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | No (falls back to in-memory) |
| `SESSION_SECRET` | Secret for signing session cookies | No (uses default in dev) |
| `PORT` | Server port | No (defaults to 5000) |

### Run

```bash
npm start          # production
npm run dev        # development with auto-reload (nodemon)
```

The storefront will be available at `http://localhost:5000` and the admin panel at `http://localhost:5000/admin.html`.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
