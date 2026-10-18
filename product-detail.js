(async () => {
  'use strict';
  const byId = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id') || 'shuoer-s12';
  const setText = (id, value) => { if (byId(id)) byId(id).textContent = value == null ? '' : String(value); };
  const formatPrice = (item, value = item.price) => {
    if (value == null || value === '') return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(Number(value)); }
    catch { return `${item.currency || ''} ${value}`.trim(); }
  };
  try {
    const allProducts = await ProductStore.seedIfEmpty();
    const product = allProducts.find(item => item.id === requestedId);
    if (!product) {
      byId('product-not-found').hidden = false;
      document.title = 'Product Not Found - Twilight Audio';
      return;
    }
    byId('product-page').hidden = false;
    document.title = `${product.name} - Twilight Audio`;
    setText('product-brand', product.brand || '');
    setText('product-name', product.name);
    setText('product-subtitle', product.subtitle || '');
    setText('product-price', formatPrice(product));
    setText('product-short-description', product.shortDescription || '');
    const oldPrice = byId('product-old-price');
    if (product.oldPrice != null && product.oldPrice !== '') { oldPrice.textContent = formatPrice(product, product.oldPrice); oldPrice.hidden = false; }

    const mainImage = byId('ProductImg');
    const thumbnailContainer = byId('product-thumbnails');
    const imageList = [...new Set([...(product.gallery || []), product.image].filter(src => typeof src === 'string' && src.trim()))];
    function selectImage(src, selectedThumbnail) {
      mainImage.src = src; mainImage.alt = product.name;
      thumbnailContainer.querySelectorAll('img').forEach(img => img.classList.toggle('selected-thumbnail', img === selectedThumbnail));
    }
    imageList.forEach((src, index) => {
      const column = document.createElement('div'); column.className = 'small-img-col';
      const thumbnail = document.createElement('img');
      thumbnail.src = src; thumbnail.alt = `${product.name} image ${index + 1}`; thumbnail.className = 'small-img';
      thumbnail.tabIndex = 0; thumbnail.setAttribute('role', 'button'); thumbnail.setAttribute('aria-label', `Show image ${index + 1}`);
      thumbnail.addEventListener('click', () => selectImage(src, thumbnail));
      thumbnail.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectImage(src, thumbnail); } });
      column.appendChild(thumbnail); thumbnailContainer.appendChild(column);
      if (index === 0) selectImage(src, thumbnail);
    });
    if (!imageList.length) { mainImage.hidden = true; mainImage.alt = `${product.name} image unavailable`; }

    const colorWrap = byId('product-color-wrap'); const colorSelect = byId('product-color');
    if (Array.isArray(product.colors) && product.colors.length) {
      colorWrap.hidden = false;
      product.colors.forEach(color => { const option = document.createElement('option'); option.value = color; option.textContent = color; colorSelect.appendChild(option); });
    }
    (product.features || []).forEach(feature => { const li = document.createElement('li'); li.textContent = feature; byId('product-features').appendChild(li); });
    (product.description || []).forEach(section => {
      const article = document.createElement('article'); article.className = 'product-description-item';
      const heading = document.createElement('h3'); const paragraph = document.createElement('p');
      heading.textContent = section.title || ''; paragraph.textContent = section.content || ''; article.append(heading, paragraph); byId('product-description').appendChild(article);
    });
    (product.specifications || []).forEach(spec => {
      const row = document.createElement('tr'); const label = document.createElement('td'); const value = document.createElement('td');
      label.textContent = spec.label || ''; value.textContent = spec.value || ''; row.append(label, value); byId('product-specifications').appendChild(row);
    });
    const relatedContainer = byId('related-products');
    const relatedItems = (product.related || []).map(id => allProducts.find(item => item.id === id)).filter(item => item && item.id !== product.id);
    relatedItems.forEach(item => {
      const card = document.createElement('div'); card.className = 'col-4 related-product-card';
      const link = document.createElement('a'); link.href = `product-detail.html?id=${encodeURIComponent(item.id)}`;
      const image = document.createElement('img'); image.src = item.image || ''; image.alt = item.name; image.loading = 'lazy';
      const name = document.createElement('h4'); name.textContent = item.name; link.append(image, name);
      const price = document.createElement('p'); price.textContent = formatPrice(item); card.append(link, price); relatedContainer.appendChild(card);
    });
    const quantityInput = byId('product-quantity'); const addToCartButton = byId('add-to-cart'); const message = byId('product-message');
    addToCartButton.addEventListener('click', () => {
      const quantity = Number(quantityInput.value);
      if (!Number.isInteger(quantity) || quantity < 1) { message.textContent = 'Please enter a quantity of at least 1.'; quantityInput.focus(); return; }
      const selectedColor = colorWrap.hidden ? '' : colorSelect.value;
      window.TwilightCart.add(product, quantity, selectedColor);
      message.textContent = `${quantity} × ${product.name} added to your cart${selectedColor ? ` (${selectedColor})` : ''}.`;
      addToCartButton.textContent = 'Added to Cart';
      window.setTimeout(() => { addToCartButton.textContent = 'Add to Cart'; }, 1500);
    });
  } catch (error) {
    console.error(error);
    byId('product-not-found').hidden = false;
    byId('product-not-found').textContent = 'Could not load products. Please run `npm start` and open http://localhost:3000.';
  }
})();
