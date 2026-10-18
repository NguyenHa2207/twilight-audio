/* ProductStore talks to the local Node.js/Express API backed by SQLite. */
(() => {
  'use strict';
  const API = '/api';
  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }
  async function seedIfEmpty() {
    // The server imports the sample catalogue into SQLite once during startup.
    // The browser never writes sample data to the database.
    return getAll();
  }
  async function getAll() { return request('/products'); }
  async function get(id) { return request(`/products/${encodeURIComponent(id)}`); }
  async function save(product) {
    const editing = Boolean(product && product.id && (await getAll()).some(item => item.id === product.id));
    return request(editing ? `/products/${encodeURIComponent(product.id)}` : '/products', {
      method: editing ? 'PUT' : 'POST', body: JSON.stringify(product)
    });
  }
  async function remove(id) {
    return request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  window.ProductStore = { getAll, get, seedIfEmpty, save, remove };
})();
