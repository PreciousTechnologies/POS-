import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "./paths.js";
import { randomToken, hashPassword } from "./security.js";

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA synchronous = NORMAL");

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function nowIso(date = new Date()) {
  return date.toISOString();
}

export function businessDate(date = new Date(), timeZone = "Africa/Dar_es_Salaam") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function roundTzs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n >= 1000) return Math.round(n / 100) * 100;
  if (n >= 100) return Math.round(n / 50) * 50;
  return Math.round(n);
}

export function getSettingsRow() {
  return db.prepare("SELECT * FROM business_settings WHERE id = 1").get();
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','cashier')),
  active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  cost_price INTEGER NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  unit TEXT,
  description TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  cashier_id TEXT NOT NULL REFERENCES users(id),
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  cost_total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT NOT NULL,
  amount_received INTEGER NOT NULL DEFAULT 0,
  change_due INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT,
  note TEXT,
  idempotency_key TEXT UNIQUE,
  business_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  voided_at TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  reference TEXT,
  simulated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  amount INTEGER NOT NULL,
  cost_amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  restock INTEGER NOT NULL DEFAULT 0,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_change INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT,
  reference TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tin TEXT,
  currency TEXT NOT NULL DEFAULT 'TZS',
  timezone TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  receipt_footer TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  allow_discounts INTEGER NOT NULL DEFAULT 1,
  discount_limit_pct INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(business_date);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`);

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const TZ = "Africa/Dar_es_Salaam";
const SEED_DAYS = 59;

const CATEGORY_CATALOG = [
  {
    name: "Beverages",
    description: "Sodas, water, juices, tea and coffee",
    brands: ["Azam", "Kilimanjaro", "Coca-Cola", "Pepsi", "Mo", "Serengeti", "Dasani", "Raha", "Bora", "Tangawizi", "Nescafé", "Lipton", "Delmonte", "Minute Maid"],
    items: [
      ["Soda", "500ml", 1200, 820],
      ["Bottled Water", "1.5L", 1000, 620],
      ["Orange Juice", "1L", 4500, 3300],
      ["Mango Juice", "1L", 4200, 3050],
      ["Black Tea", "250g", 3500, 2500],
      ["Instant Coffee", "100g", 6500, 4800],
      ["Energy Drink", "250ml", 2500, 1700],
      ["Malt Drink", "330ml", 2000, 1400],
      ["Mineral Water", "500ml", 600, 350],
      ["Coconut Water", "330ml", 2500, 1750],
      ["Drinking Chocolate", "400g", 8000, 6200],
      ["Flavoured Yogurt", "500ml", 3000, 2100],
    ],
  },
  {
    name: "Food & Grains",
    description: "Staples, flour, rice, oils and pantry goods",
    brands: ["Azam", "Kilombero", "Pembe", "Ndovu", "Mwezi", "Tembo", "Bidco", "Murzah", "Mama", "Golden", "Bahari", "Salim", "Zanzibar", "Raha"],
    items: [
      ["Rice", "5kg", 18000, 14500],
      ["Maize Flour", "2kg", 4200, 3400],
      ["Wheat Flour", "2kg", 5000, 4000],
      ["Sugar", "1kg", 3200, 2600],
      ["Iodized Salt", "1kg", 1200, 800],
      ["Cooking Oil", "2L", 9500, 7800],
      ["Sunflower Oil", "1L", 5200, 4200],
      ["Red Beans", "1kg", 4800, 3800],
      ["Lentils", "1kg", 6500, 5200],
      ["Spaghetti", "500g", 2500, 1800],
      ["Powdered Milk", "400g", 9500, 7600],
      ["Peanut Butter", "400g", 7000, 5500],
    ],
  },
  {
    name: "Household",
    description: "Cleaning, laundry and home essentials",
    brands: ["Sunlight", "Omo", "Ariel", "Geisha", "Foma", "Vim", "Dettol", "Harpic", "Kiwi", "Eveready", "Tiger", "Bic", "Softcare", "Uhuru"],
    items: [
      ["Laundry Soap", "800g", 4500, 3400],
      ["Washing Powder", "1kg", 6500, 5000],
      ["Dish Soap", "500ml", 3500, 2600],
      ["Bleach", "750ml", 2800, 2000],
      ["Toilet Cleaner", "500ml", 4200, 3100],
      ["Tissue Roll", "200s", 2200, 1500],
      ["Kitchen Sponge", "2pcs", 1500, 900],
      ["Broom", "1pc", 5500, 4000],
      ["Matches", "10 boxes", 2000, 1300],
      ["Candles", "6pcs", 3500, 2500],
      ["Charcoal", "5kg", 8000, 6500],
      ["Kerosene", "1L", 3200, 2700],
    ],
  },
  {
    name: "Personal Care",
    description: "Hygiene, beauty and everyday self-care",
    brands: ["Colgate", "Close-Up", "Nivea", "Dove", "Geisha", "Sunsilk", "Always", "Gillette", "Vaseline", "Rexona", "Lux", "Lifebuoy", "Amara", "Nice & Lovely"],
    items: [
      ["Toothpaste", "100ml", 3500, 2500],
      ["Toothbrush", "1pc", 1800, 1000],
      ["Body Lotion", "400ml", 8500, 6500],
      ["Shampoo", "400ml", 9000, 7000],
      ["Sanitary Pads", "10pcs", 4500, 3400],
      ["Razor", "5pcs", 4000, 2800],
      ["Deodorant", "150ml", 6500, 4900],
      ["Petroleum Jelly", "250ml", 4500, 3300],
      ["Bathing Soap", "175g", 1800, 1200],
      ["Hand Sanitizer", "250ml", 3500, 2400],
      ["Face Cream", "100ml", 7000, 5200],
      ["Cotton Buds", "100pcs", 2000, 1200],
    ],
  },
  {
    name: "Snacks",
    description: "Biscuits, crisps, sweets and breakfast bites",
    brands: ["Biskrem", "Britania", "Krackers", "Blue Band", "Cadbury", "Kit Kat", "Raha", "Twist", "Sumo", "Peptang", "Manji", "Azam", "Tembo", "Munchy"],
    items: [
      ["Biscuits", "200g", 2500, 1700],
      ["Digestive Biscuits", "250g", 3200, 2300],
      ["Potato Crisps", "90g", 2000, 1300],
      ["Peanuts", "200g", 3000, 2100],
      ["Chocolate Bar", "90g", 4500, 3300],
      ["Chewing Gum", "10pcs", 1500, 900],
      ["Popcorn", "100g", 1800, 1100],
      ["Cake Bar", "60g", 1200, 700],
      ["Corn Flakes", "375g", 8500, 6500],
      ["Oats", "500g", 6000, 4600],
      ["Mixed Nuts", "250g", 7500, 5600],
      ["Candy Pack", "50pcs", 5000, 3600],
    ],
  },
  {
    name: "Stationery",
    description: "School, office and writing supplies",
    brands: ["Bic", "Oxford", "Camlin", "Faber", "Stabilo", "Pilot", "Uhu", "Rotring", "Pelikan", "Artline", "Classmate", "Pentel", "Staedtler", "Kokuyo"],
    items: [
      ["Exercise Book", "48p", 2000, 1300],
      ["Exercise Book", "96p", 3000, 2100],
      ["Ballpoint Pen", "5pcs", 2500, 1500],
      ["Pencil", "12pcs", 3500, 2300],
      ["Ruler", "30cm", 1500, 800],
      ["Eraser", "2pcs", 1000, 500],
      ["Sharpener", "1pc", 1200, 600],
      ["Glue Stick", "20g", 2200, 1400],
      ["Envelopes", "20pcs", 3000, 1900],
      ["Marker", "4pcs", 4500, 3000],
      ["Notebook", "A4 120p", 6500, 4700],
      ["Calculator", "12-digit", 15000, 11000],
    ],
  },
  {
    name: "Electronics",
    description: "Small appliances, power and lighting",
    brands: ["Philips", "Nokia", "Samsung", "Tecno", "Eveready", "Tiger", "Sonitec", "Hitachi", "LG", "Beko", "Von", "Sun King", "Anker", "Oraimo"],
    items: [
      ["LED Bulb", "9W", 4500, 3200],
      ["LED Bulb", "15W", 6500, 4700],
      ["Phone Charger", "1pc", 8000, 5500],
      ["USB Cable", "1m", 5000, 3200],
      ["AA Batteries", "4pcs", 4000, 2800],
      ["Rechargeable Torch", "1pc", 15000, 11000],
      ["Extension Cord", "3m", 14000, 10000],
      ["Electric Kettle", "1.7L", 45000, 35000],
      ["Flat Iron", "1pc", 38000, 29000],
      ["Radio", "1pc", 25000, 19000],
      ["Power Bank", "10000mAh", 35000, 26000],
      ["Table Fan", "16in", 68000, 52000],
    ],
  },
  {
    name: "Baby Care",
    description: "Diapers, feeding and baby hygiene",
    brands: ["Pampers", "Huggies", "Nivea Baby", "Johnson's", "Geisha", "Bella", "Molfix", "Softcare", "Pigeon", "Philips Avent", "Baby Joy", "Mamypoko", "Tolly", "Cussons"],
    items: [
      ["Diapers", "20pcs", 18000, 14500],
      ["Baby Wipes", "80pcs", 6500, 4900],
      ["Baby Soap", "100g", 3500, 2500],
      ["Baby Lotion", "200ml", 7500, 5800],
      ["Baby Oil", "200ml", 8000, 6200],
      ["Baby Porridge", "250g", 6500, 5000],
      ["Feeding Bottle", "250ml", 12000, 8800],
      ["Pacifier", "2pcs", 5000, 3500],
      ["Baby Powder", "200g", 5500, 4000],
      ["Baby Shampoo", "200ml", 7000, 5300],
      ["Nappy Rash Cream", "50g", 8500, 6500],
      ["Baby Towel", "1pc", 12000, 9000],
    ],
  },
];

const PACK_VARIANTS = [
  { suffix: "", multiplier: 1 },
  { suffix: "Pack of 3", multiplier: 3, discount: 0.97 },
  { suffix: "Pack of 6", multiplier: 6, discount: 0.94 },
  { suffix: "Carton of 12", multiplier: 12, discount: 0.9 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/* Deterministic UUIDv4-shaped id for seeded rows.
   Serverless platforms seed their own copy of the demo database per instance;
   fixed ids keep every instance's catalog identical, so a record created or
   referenced on one instance still resolves on another. */
let seedIdCounter = 0;
function seededId() {
  seedIdCounter += 1;
  return `00000000-0000-4000-8000-${seedIdCounter.toString(16).padStart(12, "0")}`;
}

function audit(userId, action, entity, entityId, description, meta, createdAt = nowIso()) {
  db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(seededId(), userId, action, entity, entityId, description, meta ? JSON.stringify(meta) : null, createdAt);
}

function seedDatabase() {
  const rng = mulberry32(20261026);
  const now = new Date();
  const today = businessDate(now, TZ);
  const ts = nowIso(now);

  console.log("[seed] First run — creating demo data (this can take a few seconds)…");
  db.exec("BEGIN");

  try {
    /* ---------------- settings ---------------- */
    db.prepare(
      `INSERT INTO business_settings
        (id, business_name, phone, email, address, tin, currency, timezone, receipt_footer,
         low_stock_threshold, allow_discounts, discount_limit_pct, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, 'TZS', ?, ?, 10, 1, 10, ?)`,
    ).run(
      "Kariakoo Mini Market",
      "+255 754 000 111",
      "hello@kariakoominimarket.co.tz",
      "Msimbazi Street, Kariakoo, Dar es Salaam",
      "123-456-789",
      TZ,
      "Asante kwa kununua nasi! Thank you for shopping with us.\nDemo receipt — not a TRA fiscal receipt.",
      ts,
    );

    /* ---------------- users ---------------- */
    const users = [
      { id: seededId(), username: "admin", name: "Amina Mwakyusa", email: "amina@kariakoominimarket.co.tz", role: "admin", active: 1, password: "admin123" },
      { id: seededId(), username: "cashier", name: "Joseph Mtei", email: "joseph@kariakoominimarket.co.tz", role: "cashier", active: 1, password: "cashier123" },
      { id: seededId(), username: "neema", name: "Neema Kessy", email: "neema@kariakoominimarket.co.tz", role: "cashier", active: 1, password: "cashier123" },
      { id: seededId(), username: "grace", name: "Grace Mushi", email: "grace@kariakoominimarket.co.tz", role: "cashier", active: 0, password: "cashier123" },
    ];
    const insertUser = db.prepare(
      `INSERT INTO users (id, username, name, email, role, active, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const u of users) {
      insertUser.run(u.id, u.username, u.name, u.email, u.role, u.active, hashPassword(u.password), ts, ts);
    }
    audit(users[0].id, "user.create", "user", users[1].id, "Created cashier account for Joseph Mtei", null, nowIso(new Date(Date.now() - 50 * 864e5)));
    audit(users[0].id, "user.create", "user", users[2].id, "Created cashier account for Neema Kessy", null, nowIso(new Date(Date.now() - 40 * 864e5)));

    /* ---------------- categories ---------------- */
    const insertCategory = db.prepare(
      `INSERT INTO categories (id, name, description, active, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    );
    const categories = CATEGORY_CATALOG.map((c) => {
      const id = seededId();
      insertCategory.run(id, c.name, c.description, ts, ts);
      return { ...c, id };
    });

    /* ---------------- products ---------------- */
    const insertProduct = db.prepare(
      `INSERT INTO products
        (id, sku, barcode, name, category_id, cost_price, price, stock, min_stock, unit, description, image_url, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    );

    const products = [];
    let counter = 0;
    for (const category of categories) {
      for (let bi = 0; bi < category.brands.length; bi++) {
        const brand = category.brands[bi];
        const brandFactor = 0.92 + (bi % 6) * 0.035;
        for (const [itemName, unit, basePrice, baseCost] of category.items) {
          for (const variant of PACK_VARIANTS) {
            counter += 1;
            const price = roundTzs(basePrice * brandFactor * variant.multiplier * (variant.discount ?? 1));
            const cost = roundTzs(baseCost * (0.94 + (bi % 4) * 0.03) * variant.multiplier * (variant.discount ?? 1));
            const stock = 18 + Math.floor(rng() * 210);
            const minStock = 5 + (counter % 4) * 5;
            const product = {
              id: seededId(),
              sku: `SKU-${String(counter).padStart(5, "0")}`,
              barcode: `629${String(counter).padStart(10, "0")}`,
              name: `${brand} ${itemName} ${unit}${variant.suffix ? ` · ${variant.suffix}` : ""}`,
              categoryId: category.id,
              categoryName: category.name,
              costPrice: cost,
              price,
              stock,
              minStock,
              unit,
              active: 1,
            };
            insertProduct.run(
              product.id,
              product.sku,
              product.barcode,
              product.name,
              product.categoryId,
              product.costPrice,
              product.price,
              product.stock,
              product.minStock,
              product.unit,
              null,
              1,
              ts,
              ts,
            );
            products.push(product);
          }
        }
      }
    }

    audit(users[0].id, "product.create", "product", null, `Seeded ${products.length} demo products across 8 categories`, { count: products.length }, nowIso(new Date(Date.now() - 45 * 864e5)));

    /* ---------------- sales ---------------- */
    const insertSale = db.prepare(
      `INSERT INTO sales
        (id, ref, cashier_id, subtotal, discount, total, cost_total, status, payment_method,
         amount_received, change_due, customer_name, note, idempotency_key, business_date, created_at, voided_at, refunded_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    );
    const insertSaleItem = db.prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, name, sku, qty, unit_price, discount, line_total, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    );
    const insertPayment = db.prepare(
      `INSERT INTO payments (id, sale_id, method, amount, status, reference, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateStock = db.prepare(`UPDATE products SET stock = ? WHERE id = ?`);

    const cashiers = [users[1].id, users[1].id, users[1].id, users[2].id, users[0].id];
    const methods = ["cash", "cash", "cash", "cash", "mobile_money", "mobile_money", "mobile_money", "card"];
    const mobileProviders = ["M-Pesa", "Airtel Money", "Tigo Pesa", "Halopesa"];
    const customers = ["Walk-in customer", "Walk-in customer", "Mama Asha", "Peter M.", "Zawadi Shop", "Rehema K.", "Ali Juma", "Baraka S.", "Fatuma M."];
    const pool = products.slice(0, 320);
    const sales = [];
    let refCounter = 0;

    const currentHour = now.getHours();

    for (let offset = SEED_DAYS; offset >= 0; offset--) {
      const date = addDays(today, -offset);
      const maxSales = offset === 0 ? 12 : offset === 1 ? 9 : 3 + Math.floor(rng() * 5);
      for (let s = 0; s < maxSales; s++) {
        const itemCount = 1 + Math.floor(rng() * 5);
        const chosen = new Set();
        const lines = [];
        for (let i = 0; i < itemCount; i++) {
          let product = pick(rng, pool);
          let guard = 0;
          while (chosen.has(product.id) && guard++ < 20) product = pick(rng, pool);
          if (chosen.has(product.id)) continue;
          const qty = 1 + Math.floor(rng() * 4);
          if (product.stock < qty) continue;
          chosen.add(product.id);
          product.stock -= qty;
          lines.push({ product, qty });
        }
        if (!lines.length) continue;

        const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
        const discount = rng() < 0.07 ? roundTzs(subtotal * 0.03) : 0;
        const total = subtotal - discount;
        const costTotal = lines.reduce((sum, l) => sum + l.product.costPrice * l.qty, 0);
        const method = pick(rng, methods);
        const cashierId = pick(rng, cashiers);
        const isCash = method === "cash";
        const amountReceived = isCash ? total + pick(rng, [0, 0, 500, 1000, 2000, 5000]) : total;
        const changeDue = Math.max(0, amountReceived - total);
        const customer = pick(rng, customers);

        let hour = 8 + Math.floor(rng() * 12);
        if (offset === 0) hour = 8 + Math.floor(rng() * Math.max(1, Math.min(currentHour + 1, 12)));
        const minute = Math.floor(rng() * 60);
        const createdAt = new Date(Date.UTC(
          Number(date.slice(0, 4)),
          Number(date.slice(5, 7)) - 1,
          Number(date.slice(8, 10)),
          hour - 3,
          minute,
          Math.floor(rng() * 60),
        )).toISOString();

        refCounter += 1;
        const ref = `POS-${date.replaceAll("-", "")}-${String(refCounter).padStart(4, "0")}`;
        const saleId = seededId();
        const provider = isCash ? null : method === "mobile_money" ? pick(rng, mobileProviders) : "Card terminal";
        const paymentRef = isCash ? null : `SIM-${provider.replaceAll(" ", "").toUpperCase()}-${randomToken(3)}`;

        insertSale.run(
          saleId,
          ref,
          cashierId,
          subtotal,
          discount,
          total,
          costTotal,
          method,
          amountReceived,
          changeDue,
          customer,
          null,
          `seed-${saleId}`,
          date,
          createdAt,
        );

        lines.forEach((line, index) => {
          const lineTotal = line.product.price * line.qty;
          insertSaleItem.run(
            seededId(),
            saleId,
            line.product.id,
            line.product.name,
            line.product.sku,
            line.qty,
            line.product.price,
            lineTotal,
            line.product.costPrice,
          );
          updateStock.run(line.product.stock, line.product.id);
          insertMovement.run(
            seededId(),
            line.product.id,
            -line.qty,
            "sale",
            "Sale completed",
            ref,
            cashierId,
            new Date(new Date(createdAt).getTime() + index * 1000).toISOString(),
          );
        });

        insertPayment.run(
          seededId(),
          saleId,
          method,
          total,
          isCash ? "paid" : "simulated",
          paymentRef,
          isCash ? 0 : 1,
          createdAt,
        );

        sales.push({ id: saleId, ref, total, discount, costTotal, status: "completed", date, createdAt, lines, method });
      }
    }

    /* ---------------- a few voids ---------------- */
    const voidCandidates = sales.filter((s) => s.date !== today).slice(12, 16);
    for (const sale of voidCandidates) {
      const voidedAt = new Date(new Date(sale.createdAt).getTime() + 2 * 3600 * 1000).toISOString();
      db.prepare(`UPDATE sales SET status = 'voided', voided_at = ? WHERE id = ?`).run(voidedAt, sale.id);
      db.prepare(`UPDATE payments SET status = 'voided' WHERE sale_id = ?`).run(sale.id);
      for (const line of sale.lines) {
        db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`).run(line.qty, line.product.id);
        insertMovement.run(seededId(), line.product.id, line.qty, "void", "Voided sale — stock restored", sale.ref, users[0].id, voidedAt);
      }
      audit(users[0].id, "sale.void", "sale", sale.id, `Voided sale ${sale.ref} and restored stock`, { ref: sale.ref }, voidedAt);
      sale.status = "voided";
    }

    /* ---------------- a few refunds ---------------- */
    const refundCandidates = sales.filter((s) => s.status === "completed" && s.date !== today).slice(30, 34);
    for (let i = 0; i < refundCandidates.length; i++) {
      const sale = refundCandidates[i];
      const full = i % 2 === 0;
      const amount = full ? sale.total : Math.max(500, roundTzs(sale.total * 0.4));
      const costAmount = Math.round((sale.costTotal * amount) / Math.max(1, sale.total));
      const refundedAt = new Date(new Date(sale.createdAt).getTime() + (i + 1) * 6 * 3600 * 1000).toISOString();
      const refundDate = businessDate(new Date(refundedAt), TZ);
      db.prepare(
        `INSERT INTO refunds (id, sale_id, amount, cost_amount, reason, restock, user_id, business_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        seededId(),
        sale.id,
        amount,
        costAmount,
        full ? "Customer returned unused items — full refund" : "Damaged packaging — partial refund",
        full ? 1 : 0,
        users[0].id,
        refundDate,
        refundedAt,
      );
      db.prepare(`UPDATE sales SET status = ?, refunded_amount = refunded_amount + ? WHERE id = ?`).run(
        full ? "refunded" : "partially_refunded",
        amount,
        sale.id,
      );
      if (full) {
        for (const line of sale.lines) {
          db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`).run(line.qty, line.product.id);
          insertMovement.run(seededId(), line.product.id, line.qty, "return", "Full refund — stock restored", sale.ref, users[0].id, refundedAt);
        }
      }
      audit(users[0].id, "sale.refund", "sale", sale.id, `${full ? "Full" : "Partial"} refund of TZS ${amount.toLocaleString()} on ${sale.ref}`, { amount, full }, refundedAt);
      sale.status = full ? "refunded" : "partially_refunded";
    }

    /* ---------------- low / out of stock ---------------- */
    const adjustProduct = db.prepare(`UPDATE products SET stock = ?, updated_at = ? WHERE id = ?`);
    for (let i = 30; i < 46; i++) {
      const product = products[i];
      const current = db.prepare(`SELECT stock FROM products WHERE id = ?`).get(product.id).stock;
      const next = i < 38 ? 0 : Math.max(1, Math.min(product.minStock - 1, 1 + (i % 4)));
      const delta = next - current;
      adjustProduct.run(next, ts, product.id);
      insertMovement.run(seededId(), product.id, delta, "adjustment", "Stock count correction — demo seed", null, users[0].id, ts);
      product.stock = next;
    }
    audit(users[0].id, "inventory.adjust", "product", null, "Recorded demo stock corrections for low-stock alerts", { count: 16 }, nowIso(new Date(Date.now() - 20 * 3600 * 1000)));

    audit(users[0].id, "settings.update", "settings", "1", "Updated business profile and receipt configuration", null, nowIso(new Date(Date.now() - 30 * 864e5)));
    audit(users[0].id, "product.update", "product", products[0].id, `Updated selling price for ${products[0].name}`, { price: products[0].price }, nowIso(new Date(Date.now() - 5 * 864e5)));

    db.exec("COMMIT");
    console.log(`[seed] Done — ${users.length} users, ${categories.length} categories, ${products.length} products, ${sales.length} sales.`);
  } catch (error) {
    db.exec("ROLLBACK");
    console.error("[seed] Failed:", error);
    throw error;
  }
}

const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
if (Number(userCount.count) === 0) {
  seedDatabase();
}
