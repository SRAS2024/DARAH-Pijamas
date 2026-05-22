# Demo tooling

These scripts generate the demo content used to **prove the functionality of
DARAH Pijamas** (see the screenshots, video and database captures in
[`../`](../) and the project [`README`](../../README.md)).

Everything here is reproducible: point the scripts at a running instance of the
app and they will recreate the exact catalogue, homepage, about page and
analytics data shown in the documentation.

## Files

| File | Purpose |
|------|---------|
| `images.js` | Pure-JS generator of the pajama illustrations, hero banners, about-page images and brand logo. Produces self-contained SVG (returned as `data:` URLs). No dependencies. |
| `seed.js` | Logs into the admin API and seeds **20 products** (5 per collection, in Brazilian Portuguese), the homepage content, the about page and the logo. |
| `seed-analytics.js` | Inserts ~30 days of demo `visits`, `product_views` and `cart_events` straight into PostgreSQL so the admin **Análises** dashboard has realistic data. |

## How to run

```bash
# 1. Start the app with PostgreSQL + admin credentials configured
export DATABASE_URL="postgres://USER:PASS@127.0.0.1:5432/DBNAME"
export ADMIN_USERNAME="darah.demo"
export ADMIN_PASSWORD="Darah@Demo2026"
npm start

# 2. Seed the catalogue, homepage, about page and logo (via the HTTP API)
node docs/demo-tooling/seed.js

# 3. Seed the analytics tables (directly via psql)
PGUSER=USER PGPASSWORD=PASS PGDATABASE=DBNAME node docs/demo-tooling/seed-analytics.js
```

`seed.js` honours `BASE_URL`, `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
`seed-analytics.js` honours the standard libpq variables (`PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE`) and needs the `psql` client on `PATH`.

> Both scripts in this folder were executed end-to-end against a fresh
> PostgreSQL database while producing this repository's proof material, and
> again against a separate verification database — both runs created the full
> 20-product catalogue and the analytics data successfully.

## How the screenshots and walkthrough were captured

The page captures, the responsive views, the WhatsApp-checkout mock, the
walkthrough video/GIF and the database visuals in [`../screenshots/`](../screenshots/)
were produced by driving the running app in a headless Chromium browser with
[Playwright](https://playwright.dev/):

1. The app was started against a temporary PostgreSQL database.
2. `seed.js` and `seed-analytics.js` populated the catalogue and analytics.
3. A Playwright script visited every storefront and admin page, performed the
   real user flows (browse → add to cart → checkout; admin login → create →
   edit → delete product) and saved a screenshot at each step.
4. The WhatsApp deep link returned by `POST /api/checkout-link` was decoded and
   rendered inside a WhatsApp-style chat mock.
5. The PostgreSQL schema and sample rows were captured with `psql` and rendered
   as terminal-style images; the ER diagram was generated as SVG.

No screenshot is a mock-up of the UI itself — every storefront and admin
capture is the real application running against PostgreSQL.
