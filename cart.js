(() => {
  'use strict';
  const CART_KEY = 'twilightAudioCart';
  const $ = id => document.getElementById(id);
  const money = (amount, currency = 'USD') => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0); }
    catch { return `${currency} ${Number(amount) || 0}`; }
  };
  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value.filter(item => item && item.id && Number(item.quantity) > 0) : [];
    } catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadges(cart);
  }
  function updateCartBadges(cart = readCart()) {
    const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = String(count);
      el.hidden = count === 0;
      el.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'} in cart`);
    });
  }
  function render() {
    const body = $('cart-items');
    if (!body) return;
    const cart = readCart();
    body.replaceChildren();
    const empty = $('empty-cart');
    const table = $('cart-table');
    empty.hidden = cart.length > 0;
    table.hidden = cart.length === 0;
    $('cart-count').textContent = `${cart.length} product${cart.length === 1 ? '' : 's'}`;

    const totalsByCurrency = new Map();
    cart.forEach((item, index) => {
      const price = Number(item.price) || 0;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const lineTotal = price * quantity;
      totalsByCurrency.set(item.currency || 'USD', (totalsByCurrency.get(item.currency || 'USD') || 0) + lineTotal);
      const row = document.createElement('tr');
      const productCell = document.createElement('td');
      const info = document.createElement('div'); info.className = 'cart-info';
      const image = document.createElement('img'); image.src = item.image || 'images/product-1.jpg'; image.alt = item.name || 'Product';
      const details = document.createElement('div');
      const name = document.createElement('p'); name.textContent = item.name || 'Product';
      const priceText = document.createElement('small'); priceText.textContent = `Price: ${money(price, item.currency)}`;
      details.append(name, priceText);
      if (Array.isArray(item.colors) && item.colors.length) {
        const colorLabel = document.createElement('label'); colorLabel.className = 'cart-color-label'; colorLabel.textContent = 'Color: ';
        const select = document.createElement('select'); select.className = 'cart-color-select'; select.setAttribute('aria-label', `Color for ${item.name}`);
        item.colors.forEach(color => { const option = document.createElement('option'); option.value = color; option.textContent = color; option.selected = color === item.color; select.appendChild(option); });
        if (!item.colors.includes(item.color)) { const option = document.createElement('option'); option.value = item.color || ''; option.textContent = item.color || 'Choose a color'; option.selected = true; select.insertBefore(option, select.firstChild); }
        select.addEventListener('change', () => {
          const nextCart = readCart();
          const nextItem = nextCart[index];
          if (!nextItem) return;
          const otherIndex = nextCart.findIndex((candidate, i) => i !== index && candidate.id === nextItem.id && candidate.color === select.value);
          if (otherIndex >= 0) { nextCart[otherIndex].quantity = Number(nextCart[otherIndex].quantity) + Number(nextItem.quantity); nextCart.splice(index, 1); nextCart[otherIndex > index ? otherIndex - 1 : otherIndex].color = select.value; }
          else nextItem.color = select.value;
          writeCart(nextCart); render();
        });
        colorLabel.appendChild(select); details.appendChild(colorLabel);
      } else if (item.color) {
        const colorText = document.createElement('small'); colorText.textContent = `Color: ${item.color}`; details.appendChild(colorText);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.textContent = 'Remove';
      remove.addEventListener('click', () => { const next = readCart(); next.splice(index, 1); writeCart(next); render(); });
      details.appendChild(remove); info.append(image, details); productCell.appendChild(info);

      const quantityCell = document.createElement('td');
      const quantityInput = document.createElement('input'); quantityInput.type = 'number'; quantityInput.min = '1'; quantityInput.step = '1'; quantityInput.value = String(quantity); quantityInput.className = 'cart-quantity'; quantityInput.setAttribute('aria-label', `Quantity for ${item.name}`);
      quantityInput.addEventListener('change', () => {
        const value = Number(quantityInput.value);
        if (!Number.isInteger(value) || value < 1) { quantityInput.value = String(quantity); return; }
        const next = readCart(); if (next[index]) next[index].quantity = value; writeCart(next); render();
      });
      quantityCell.appendChild(quantityInput);
      const totalCell = document.createElement('td'); totalCell.className = 'cart-line-total'; totalCell.textContent = money(lineTotal, item.currency);
      row.append(productCell, quantityCell, totalCell); body.appendChild(row);
    });
    const totalsRows = $('cart-totals-rows');
    totalsRows.replaceChildren();
    if (!cart.length) {
      const row = document.createElement('tr'); const label = document.createElement('td'); const value = document.createElement('td');
      label.textContent = 'Total'; value.textContent = money(0, 'USD'); row.append(label, value); totalsRows.appendChild(row);
    } else {
      totalsByCurrency.forEach((amount, currency) => {
        const subtotalRow = document.createElement('tr'); const subtotalLabel = document.createElement('td'); const subtotalValue = document.createElement('td');
        subtotalLabel.textContent = `Subtotal (${currency})`; subtotalValue.textContent = money(amount, currency); subtotalRow.append(subtotalLabel, subtotalValue); totalsRows.appendChild(subtotalRow);
        const totalRow = document.createElement('tr'); const totalLabel = document.createElement('td'); const totalValue = document.createElement('td');
        const strongLabel = document.createElement('strong'); strongLabel.textContent = `Total (${currency})`; const strongValue = document.createElement('strong'); strongValue.textContent = money(amount, currency); totalLabel.appendChild(strongLabel); totalValue.appendChild(strongValue); totalRow.append(totalLabel, totalValue); totalsRows.appendChild(totalRow);
      });
    }
    $('clear-cart').disabled = cart.length === 0;
    updateCartBadges(cart);
  }
  window.TwilightCart = {
    add(product, quantity, color) {
      const cart = readCart();
      const amount = Math.max(1, Math.floor(Number(quantity) || 1));
      const selectedColor = color || '';
      const existing = cart.find(item => item.id === product.id && (item.color || '') === selectedColor);
      if (existing) existing.quantity = Number(existing.quantity) + amount;
      else cart.push({ id: product.id, name: product.name, brand: product.brand || '', price: Number(product.price) || 0, currency: product.currency || 'USD', image: product.image || '', colors: Array.isArray(product.colors) ? product.colors : [], color: selectedColor, quantity: amount });
      writeCart(cart);
      return cart;
    },
    count() { return readCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const clear = $('clear-cart');
    if (clear) clear.addEventListener('click', () => { if (confirm('Remove all items from your cart?')) { writeCart([]); render(); } });
    render();
  });
})();
