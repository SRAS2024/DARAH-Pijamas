"use strict";

/**
 * Seeds demo analytics data (visits, product views, cart events) spread over
 * the last 30 days so the admin "Análises" dashboard has realistic content.
 *
 * Requires the `psql` client and a reachable PostgreSQL database. Connection
 * details are taken from the standard libpq environment variables:
 *
 *   PGHOST (default 127.0.0.1)  PGPORT (default 5432)
 *   PGUSER (default darah_admin) PGDATABASE (default darah_demo)
 *   PGPASSWORD (required if the role needs a password)
 *
 * Usage:  node docs/demo-tooling/seed-analytics.js
 */

const { execSync } = require("child_process");

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST || "127.0.0.1",
  PGPORT: process.env.PGPORT || "5432",
  PGUSER: process.env.PGUSER || "darah_admin",
  PGDATABASE: process.env.PGDATABASE || "darah_demo"
};

function psql(args) {
  return execSync("psql " + args, { env: ENV }).toString();
}

const ids = psql('-tA -c "SELECT id FROM products ORDER BY created_at;"')
  .trim()
  .split("\n")
  .filter(Boolean);

if (!ids.length) {
  console.error("No products found — run seed.js first.");
  process.exit(1);
}

const pages = ["/", "/", "/", "/", "/", "/#babydoll", "/#camisolas", "/#longos", "/#infantil", "/#sobre-nos", "/#checkout"];
const refWeights = [
  ["https://www.instagram.com/", 42],
  ["https://l.instagram.com/", 14],
  ["https://www.google.com/search", 16],
  ["https://www.facebook.com/", 9],
  ["https://api.whatsapp.com/", 8],
  ["https://www.tiktok.com/", 6],
  ["", 30] // direct
];
const refPool = [];
refWeights.forEach(([r, w]) => { for (let i = 0; i < w; i++) refPool.push(r); });

const rand = (n) => Math.floor(Math.random() * n);
const visits = [], views = [], carts = [];
let vid = 0;

for (let day = 30; day >= 0; day--) {
  const count = 8 + Math.round((30 - day) * 0.7) + rand(10); // grows toward today
  for (let i = 0; i < count; i++) {
    const visitor = "demo-visitor-" + vid++;
    const ref = refPool[rand(refPool.length)];
    const page = pages[rand(pages.length)];
    const hh = 8 + rand(15), mm = rand(60);
    const ts = `NOW()::date - INTERVAL '${day} days' + TIME '${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}'`;
    visits.push(`('${page}','${visitor}','${ref}',${ts})`);
    if (Math.random() < 0.62) {
      const k = 1 + rand(3);
      for (let j = 0; j < k; j++) views.push(`('${ids[rand(ids.length)]}','${visitor}',${ts})`);
    }
    if (Math.random() < 0.24) carts.push(`('${ids[rand(ids.length)]}','${visitor}',${ts})`);
  }
}

let sql = "BEGIN;\n";
sql += "DELETE FROM visits WHERE visitor_id LIKE 'demo-visitor-%';\n";
sql += "DELETE FROM product_views WHERE visitor_id LIKE 'demo-visitor-%';\n";
sql += "DELETE FROM cart_events WHERE visitor_id LIKE 'demo-visitor-%';\n";
for (let i = 0; i < visits.length; i += 200)
  sql += "INSERT INTO visits (page,visitor_id,referrer,visited_at) VALUES " + visits.slice(i, i + 200).join(",") + ";\n";
for (let i = 0; i < views.length; i += 200)
  sql += "INSERT INTO product_views (product_id,visitor_id,viewed_at) VALUES " + views.slice(i, i + 200).join(",") + ";\n";
for (let i = 0; i < carts.length; i += 200)
  sql += "INSERT INTO cart_events (product_id,visitor_id,added_at) VALUES " + carts.slice(i, i + 200).join(",") + ";\n";
sql += "COMMIT;\n";

require("fs").writeFileSync(__dirname + "/analytics.sql", sql);
psql('-q -f "' + __dirname + '/analytics.sql"');
require("fs").unlinkSync(__dirname + "/analytics.sql");

console.log(
  "analytics seeded: " + visits.length + " visits, " + views.length +
  " product views, " + carts.length + " cart events."
);
