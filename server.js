const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_PATH = path.join(ROOT, 'twilight-audio.sqlite');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'IEM',
    price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Local admin authentication. The password hash protects login verification,
// while a separate ignored local file lets start.bat show the password every time.
// Keep admin-password.txt out of GitHub; it is only for this local development setup.
const AUTH_PATH = path.join(ROOT, 'admin-auth.json');
const PASSWORD_PATH = path.join(ROOT, 'admin-password.txt');
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function printAdminCredentials(username, password, reset = false) {
  console.log('\n========== TWILIGHT AUDIO ADMIN LOGIN ==========');
  if (reset) console.log('A new password was generated because the local password file was missing or invalid.');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log('This password is also saved locally in admin-password.txt.');
  console.log('Do not commit or share that file.');
  console.log('================================================\n');
}
function createAdminAccount(username = 'admin', password = crypto.randomBytes(12).toString('base64url')) {
  const salt = crypto.randomBytes(16).toString('hex');
  const saved = { username, salt, passwordHash: hashPassword(password, salt) };
  fs.writeFileSync(AUTH_PATH, JSON.stringify(saved, null, 2), { mode: 0o600 });
  fs.writeFileSync(PASSWORD_PATH, `${password}\n`, { mode: 0o600 });
  return { saved, password };
}
function loadOrCreateAdmin() {
  if (!fs.existsSync(AUTH_PATH)) {
    const { saved, password } = createAdminAccount();
    printAdminCredentials(saved.username, password);
    return saved;
  }

  const saved = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
  if (!saved.username || !saved.salt || !saved.passwordHash) {
    throw new Error('admin-auth.json is invalid. Delete it and restart to create a new admin account.');
  }

  let password = '';
  if (fs.existsSync(PASSWORD_PATH)) {
    password = fs.readFileSync(PASSWORD_PATH, 'utf8').trim();
  }
  if (password && timingSafeEqualText(hashPassword(password, saved.salt), saved.passwordHash)) {
    printAdminCredentials(saved.username, password);
    return saved;
  }

  // A hash cannot be reversed. If the local display file is missing or out of sync,
  // reset the local admin password once so the owner can sign in and see it each run.
  const created = createAdminAccount(saved.username || 'admin');
  printAdminCredentials(created.saved.username, created.password, true);
  return created.saved;
}
const adminAccount = loadOrCreateAdmin();
function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)twilight_admin_session=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}
function requireAdmin(req, res, next) {
  if (getSession(req)) return next();
  if (req.path === '/admin-products.html' || req.path === '/admin-products.js') {
    const nextPath = encodeURIComponent(req.path === '/admin-products.js' ? '/admin-products.html' : req.originalUrl);
    return res.redirect(`/admin-login.html?next=${nextPath}`);
  }
  return res.status(401).json({ error: 'You must sign in as an administrator to perform this action.' });
}

app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));
// The database and server configuration must never be served as static files.
app.use((req, res, next) => {
  if (/^\/(?:server\.js|package(?:-lock)?\.json|\.gitignore|admin-auth\.json|admin-password\.txt|twilight-audio\.sqlite(?:-shm|-wal)?)$/i.test(req.path)) {
    return res.status(404).end();
  }
  next();
});
// Gate the management page and every mutating product API on the server side.
app.use((req, res, next) => {
  if (req.path === '/admin-products.html' || req.path === '/admin-products.js') return requireAdmin(req, res, next);
  const mutatingProductApi = req.path === '/api/seed' || /^\/api\/products(?:\/[^/]+)?$/.test(req.path);
  if (mutatingProductApi && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return requireAdmin(req, res, next);
  next();
});
app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'ignore' }));

function publicProduct(row) {
  if (!row) return null;
  try { return JSON.parse(row.data_json); }
  catch { return null; }
}
function getProduct(id) {
  return publicProduct(db.prepare('SELECT data_json FROM products WHERE id = ?').get(id));
}
function getAllProducts() {
  return db.prepare('SELECT data_json FROM products ORDER BY name COLLATE NOCASE').all().map(publicProduct).filter(Boolean);
}
function cleanId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}
function saveImageDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
  const match = value.match(/^data:image\/(png|jpe?g|webp|gif|avif);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error('Invalid image. Use PNG, JPG, WebP, GIF, or AVIF.');
  const extension = match[1].toLowerCase().replace('jpeg', 'jpg');
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${extension}`;
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (buffer.length > 12 * 1024 * 1024) throw new Error('Each image must be smaller than 12 MB.');
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer, { flag: 'wx' });
  return `uploads/${filename}`;
}
function persistUploadedImages(product) {
  const copy = { ...product };
  // Reuse the same saved path if the primary image also appears in the gallery.
  const converted = new Map();
  const normalizeImage = value => {
    if (typeof value !== 'string' || !value) return '';
    if (!value.startsWith('data:image/')) return value;
    if (!converted.has(value)) converted.set(value, saveImageDataUrl(value));
    return converted.get(value);
  };
  copy.gallery = Array.isArray(copy.gallery) ? copy.gallery.map(normalizeImage).filter(Boolean) : [];
  copy.image = normalizeImage(copy.image || '');
  if (copy.image && !copy.gallery.includes(copy.image)) copy.gallery.unshift(copy.image);
  copy.gallery = [...new Set(copy.gallery)];
  if (!copy.image && copy.gallery.length) copy.image = copy.gallery[0];
  return copy;
}
function validateProduct(input, forcedId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid product data.');
  const name = String(input.name || '').trim();
  const price = Number(input.price);
  if (!name) throw new Error('Product name is required.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Product price must be a non-negative number.');
  const id = cleanId(forcedId || input.id || name.replace(/\s+/g, '-'));
  if (!id) throw new Error('Could not create a product ID.');
  const product = persistUploadedImages({
    ...input, id, name, price,
    brand: String(input.brand || '').trim(),
    category: String(input.category || 'IEM').trim() || 'IEM',
    currency: String(input.currency || 'USD').trim().toUpperCase(),
    colors: Array.isArray(input.colors) ? input.colors.map(v => String(v).trim()).filter(Boolean) : [],
    features: Array.isArray(input.features) ? input.features.map(v => String(v).trim()).filter(Boolean) : [],
    gallery: Array.isArray(input.gallery) ? input.gallery : [],
    specifications: Array.isArray(input.specifications) ? input.specifications : [],
    description: Array.isArray(input.description) ? input.description : [],
    related: Array.isArray(input.related) ? input.related : []
  });
  return product;
}
function writeProduct(product, isUpdate) {
  const sql = isUpdate
    ? `UPDATE products SET name=@name, brand=@brand, category=@category, price=@price, currency=@currency, data_json=@data_json, updated_at=CURRENT_TIMESTAMP WHERE id=@id`
    : `INSERT INTO products (id,name,brand,category,price,currency,data_json) VALUES (@id,@name,@brand,@category,@price,@currency,@data_json)`;
  const statement = db.prepare(sql);
  const result = statement.run({
    id: product.id, name: product.name, brand: product.brand || '', category: product.category || 'IEM',
    price: product.price, currency: product.currency || 'USD', data_json: JSON.stringify(product)
  });
  if (isUpdate && result.changes === 0) return false;
  return true;
}
function seedDatabaseFromSampleCatalogue() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const marker = db.prepare('SELECT value FROM settings WHERE key = ?').get('initial_seed_done');
  if (count > 0 || marker?.value === 'yes') return;
  // Seed data is shipped with the project so a fresh download has products
  // immediately. Existing databases are never overwritten by this step.
  const cataloguePath = path.join(ROOT, 'sample-products.json');
  if (!fs.existsSync(cataloguePath)) {
    console.warn('sample-products.json not found; starting with an empty product catalogue.');
    return;
  }
  const items = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));
  if (!Array.isArray(items)) throw new Error('sample-products.json must contain a JSON array.');
  const seed = db.transaction(products => {
    for (const item of products) writeProduct(validateProduct(item, item.id), false);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('initial_seed_done', 'yes');
  });
  seed(items);
  console.log(`Imported ${items.length} sample products into SQLite.`);
}

function asyncRoute(handler) {
  return (req, res) => {
    try { handler(req, res); }
    catch (error) {
      const status = /already exists/i.test(error.message) ? 409 : 400;
      res.status(status).json({ error: error.message || 'An error occurred.' });
    }
  };
}

app.get('/api/auth/status', (req, res) => res.json({ authenticated: Boolean(getSession(req)) }));
app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  if (!timingSafeEqualText(username, adminAccount.username) ||
      !timingSafeEqualText(hashPassword(password, adminAccount.salt), adminAccount.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `twilight_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => {
  const current = getSession(req);
  if (current) sessions.delete(current.token);
  res.setHeader('Set-Cookie', 'twilight_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, database: path.basename(DB_PATH) }));
app.get('/api/products', asyncRoute((req, res) => res.json(getAllProducts())));
app.get('/api/products/:id', asyncRoute((req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
}));
app.post('/api/seed', asyncRoute((req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('initial_seed_done');
  if (count > 0) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('initial_seed_done', 'yes');
    return res.json({ seeded: false, count });
  }
  // Do not restore defaults if the owner intentionally deletes every product later.
  if (alreadySeeded && alreadySeeded.value === 'yes') return res.json({ seeded: false, count: 0 });
  const incoming = Array.isArray(req.body.products) ? req.body.products : [];
  const insert = db.transaction(items => {
    for (const item of items) {
      const product = validateProduct(item, item.id);
      writeProduct(product, false);
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('initial_seed_done', 'yes');
  });
  insert(incoming);
  res.json({ seeded: incoming.length > 0, count: db.prepare('SELECT COUNT(*) AS count FROM products').get().count });
}));
app.post('/api/products', asyncRoute((req, res) => {
  const product = validateProduct(req.body);
  if (db.prepare('SELECT id FROM products WHERE id = ?').get(product.id)) throw new Error(`Product ID “${product.id}” already exists. Please change the product name or ID.`);
  writeProduct(product, false);
  res.status(201).json(product);
}));
app.put('/api/products/:id', asyncRoute((req, res) => {
  const product = validateProduct(req.body, req.params.id);
  if (!writeProduct(product, true)) return res.status(404).json({ error: 'Product to update was not found.' });
  res.json(product);
}));
app.delete('/api/products/:id', asyncRoute((req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Product to delete was not found.' });
  res.json({ deleted: true, id: req.params.id });
}));
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Server error.' });
});

seedDatabaseFromSampleCatalogue();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Twilight Audio is running at: http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
