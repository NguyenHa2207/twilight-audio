# Twilight Audio

A responsive audio-storefront project built with **HTML, CSS, JavaScript, Node.js, Express, and SQLite**. The project demonstrates a small e-commerce workflow for in-ear monitors and audio products, including a product catalogue, dynamic product details, a shopping cart, and a password-protected product management area.

> This is a local development/demo project. It does not currently process real payments or provide production-grade multi-user accounts.

## Features

- **Storefront:** homepage and product listing with sample audio products.
- **Dynamic product details:** product name, brand, price, gallery images, colors, description, features, and specifications come from the database.
- **Shopping cart:** add products, merge matching product/color items, change quantities and colors, remove items, clear the cart, and calculate subtotals.
- **Admin login:** product management requires an authenticated admin session; write APIs are protected on the server as well as the UI.
- **Product CRUD:** create, view, edit, and delete products without editing the source code.
- **SQLite database:** catalogue data is stored in `twilight-audio.sqlite` and created automatically.
- **Sample catalogue:** a new empty database is populated from `sample-products.json` on first launch. Existing catalogues are not overwritten.
- **Local image uploads:** uploaded product images are saved in `uploads/`.
- **One-click Windows startup:** `start.bat` checks Node.js and installs dependencies if needed, then starts the server.

## Requirements

- Windows for the included `start.bat` launcher (manual commands also work on other platforms).
- [Node.js 20 or newer](https://nodejs.org/).
- Internet access for the first `npm install` so npm can download project dependencies.
- A modern web browser.

## Quick start (Windows)

1. Download or clone this repository and extract it to a normal folder.
2. Install Node.js 20 or newer if it is not already installed.
3. Double-click **`start.bat`**.
4. On the first launch, the script installs dependencies if `node_modules` is missing, then starts the server.
5. Open **<http://localhost:3000>** in your browser.
6. Keep the terminal window open while using the site. Press `Ctrl+C` in that window to stop the server.

The launcher skips `npm install` when dependencies are already present. You do not need to install them every time. Run the installation again only if `node_modules` is missing, dependencies change, or the install becomes corrupted.

### Manual start

From the project directory, run:

```bash
npm install
npm start
```

Then visit <http://localhost:3000>.

## Admin login and password

- Open <http://localhost:3000/admin-login.html>.
- The username is `admin` by default.
- **The terminal window displays the current admin password every time the server starts**, including when started through `start.bat`.
- The password is also stored locally in `admin-password.txt` so it can be displayed again. The server stores a salted scrypt password hash in `admin-auth.json` for login verification.
- After login, open <http://localhost:3000/admin-products.html> to manage products.
- Use **Sign Out** when finished.

**Security note:** `admin-password.txt` contains a plain-text password. It is added to `.gitignore` and must never be committed, uploaded, or shared. This password-display behavior is intended for a local portfolio/demo project, not a publicly hosted production service. If you accidentally publish the file, change the admin password and remove the secret from the repository history.

## Sample products and database behavior

- `sample-products.json` contains the starter catalogue.
- On a fresh install, the server creates `twilight-audio.sqlite` and imports the sample products automatically.
- If the database already contains products or the initial seed has already run, the server does not overwrite your data or restore products you intentionally deleted.
- To reset the catalogue, stop the server and back up your data first. Then delete `twilight-audio.sqlite` and its `-wal` / `-shm` files. The next start creates a fresh database and imports the sample products. This permanently removes the old catalogue if you have not backed it up.

## Shopping cart

The cart is stored in the current browser's `localStorage`, not in SQLite. It persists across page reloads in that browser but is not synchronized across devices or users. The checkout/payment flow is not implemented. If the cart contains different currencies, subtotals are calculated separately instead of adding unlike currencies together.

## Project structure

```text
.
├── server.js                 # Express server, API routes, auth, SQLite setup and sample seeding
├── package.json              # Node.js dependencies and scripts
├── start.bat                 # Windows launcher
├── sample-products.json      # Starter product data
├── index.html                # Homepage
├── products.html             # Product catalogue
├── product-detail.html       # Dynamic product details
├── product-detail.js         # Loads and renders a product by ID
├── cart.html / cart.js       # Shopping cart UI and behavior
├── admin-login.html          # Admin sign-in page
├── admin-products.html       # Admin product management UI
├── admin-products.js         # Product CRUD interactions
├── product-store.js          # Frontend API helper
├── products-list.js          # Product listing renderer
├── style.css                 # Shared styling
├── images/                   # Storefront and sample images
├── uploads/                  # User-uploaded product images
├── twilight-audio.sqlite     # Generated local SQLite database (not committed)
├── admin-auth.json           # Generated admin password hash (not committed)
└── admin-password.txt        # Generated local display password (not committed)
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/products` | List products |
| `GET` | `/api/products/:id` | Get one product |
| `POST` | `/api/products` | Create product (admin login required) |
| `PUT` | `/api/products/:id` | Update product (admin login required) |
| `DELETE` | `/api/products/:id` | Delete product (admin login required) |
| `POST` | `/api/auth/login` | Sign in as admin |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/health` | Basic server health check |
