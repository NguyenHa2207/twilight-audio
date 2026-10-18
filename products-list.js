(async () => {
  const container = document.getElementById('product-catalog') || document.getElementById('home-product-catalog');
  const formatPrice = product => {
    try { return new Intl.NumberFormat('en-US', {style:'currency',currency:product.currency||'USD'}).format(Number(product.price)||0); }
    catch { return `${product.currency||''} ${product.price}`.trim(); }
  };
  try {
    const products = await ProductStore.seedIfEmpty();
    container.replaceChildren();
    if (!products.length) { container.textContent = 'No products yet. Open Manage Products to add one.'; return; }
    products.forEach(product => {
      const card = document.createElement('div'); card.className = 'col-4';
      const link = document.createElement('a'); link.href = `product-detail.html?id=${encodeURIComponent(product.id)}`;
      const image = document.createElement('img'); image.src = product.image || ''; image.alt = product.name; image.loading = 'lazy';
      const name = document.createElement('h4'); name.textContent = product.name;
      link.append(image, name); card.appendChild(link);
      if (product.brand) { const brand = document.createElement('small'); brand.textContent = product.brand; card.appendChild(brand); }
      const price = document.createElement('p'); price.textContent = formatPrice(product); card.appendChild(price);
      container.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    container.textContent = 'Could not load products. Please run `npm start` and open http://localhost:3000.';
  }
})();
