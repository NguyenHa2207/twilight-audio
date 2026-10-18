(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('product-form');
  const fields = ['name','brand','price','currency','old-price','category','subtitle','short-description','colors','image-urls','features','specifications','description'];
  let uploadedImages = [];
  let products = [];
  const slugify = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'product';
  const lines = value => value.split('\n').map(s => s.trim()).filter(Boolean);
  const pairLines = value => lines(value).map(line => { const index = line.indexOf(':'); return index < 0 ? {title: line, content: ''} : {title: line.slice(0,index).trim(), content: line.slice(index+1).trim()}; });
  const specLines = value => lines(value).map(line => { const index = line.indexOf(':'); return index < 0 ? {label: line, value: ''} : {label: line.slice(0,index).trim(), value: line.slice(index+1).trim()}; });
  const priceText = item => { try { return new Intl.NumberFormat('en-US',{style:'currency',currency:item.currency||'USD'}).format(Number(item.price)||0); } catch { return `${item.currency||''} ${item.price}`; } };
  const status = message => { $('admin-status').textContent = message; };
  const fileToDataURL = file => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });

  async function refresh() {
    products = (await ProductStore.getAll()).sort((a,b) => a.name.localeCompare(b.name));
    const query = $('search-products').value.trim().toLowerCase();
    const filtered = products.filter(p => `${p.name} ${p.brand||''}`.toLowerCase().includes(query));
    $('product-count').textContent = `(${products.length})`;
    const list = $('admin-product-list'); list.replaceChildren();
    if (!filtered.length) { const empty = document.createElement('p'); empty.className='admin-empty'; empty.textContent='No matching products found.'; list.appendChild(empty); return; }
    filtered.forEach(product => {
      const row = document.createElement('article'); row.className='admin-product';
      const img = document.createElement('img'); img.src=product.image||''; img.alt=product.name;
      const info = document.createElement('div'); const name = document.createElement('h3'); name.textContent=product.name;
      const meta = document.createElement('p'); meta.textContent=`${priceText(product)} · ${(product.colors||[]).length} color(s) · ${(product.gallery||[]).length || (product.image?1:0)} image(s)`;
      info.append(name,meta);
      const actions = document.createElement('div'); actions.className='admin-product-actions';
      const edit = document.createElement('button'); edit.className='admin-btn secondary'; edit.type='button'; edit.textContent='Edit'; edit.addEventListener('click',()=>loadProduct(product));
      const remove = document.createElement('button'); remove.className='admin-btn danger'; remove.type='button'; remove.textContent='Delete'; remove.addEventListener('click',async()=>{ if (!confirm(`Are you sure you want to delete “${product.name}”?`)) return; await ProductStore.remove(product.id); if ($('edit-id').value===product.id) resetForm(); await refresh(); status(`Deleted product “${product.name}”.`); });
      actions.append(edit,remove); row.append(img,info,actions); list.appendChild(row);
    });
  }

  function loadProduct(product) {
    $('edit-id').value=product.id;
    $('name').value=product.name||''; $('brand').value=product.brand||''; $('price').value=product.price??'';
    $('currency').value=product.currency||'USD'; $('old-price').value=product.oldPrice??''; $('category').value=product.category||'';
    $('subtitle').value=product.subtitle||''; $('short-description').value=product.shortDescription||'';
    $('colors').value=(product.colors||[]).join('\n'); $('image-urls').value=[...new Set([...(product.gallery||[]),product.image].filter(Boolean))].join('\n');
    $('features').value=(product.features||[]).join('\n'); $('specifications').value=(product.specifications||[]).map(s=>`${s.label}: ${s.value}`).join('\n');
    $('description').value=(product.description||[]).map(s=>`${s.title}: ${s.content}`).join('\n');
    uploadedImages=[]; $('image-files').value=''; renderPreview(); $('form-heading').textContent=`Edit Product: ${product.name}`; status(`Editing “${product.name}”.`); window.scrollTo({top:0,behavior:'smooth'});
  }

  function resetForm() { form.reset(); $('edit-id').value=''; $('currency').value='USD'; $('category').value='IEM'; uploadedImages=[]; $('image-files').value=''; renderPreview(); $('form-heading').textContent='Add New Product'; }
  function renderPreview() { const wrap=$('image-preview'); wrap.replaceChildren(); uploadedImages.forEach(src=>{const img=document.createElement('img');img.src=src;img.alt='Selected image';wrap.appendChild(img);}); }
  $('image-files').addEventListener('change',async event=>{ try { const files=[...event.target.files]; uploadedImages=await Promise.all(files.map(fileToDataURL)); renderPreview(); status(`Selected ${uploadedImages.length} image(s). Click “Save Product” to save.`); } catch { status('Could not read one of the selected images.'); } });
  $('search-products').addEventListener('input',refresh);
  $('reset-form').addEventListener('click',()=>{resetForm();status('Form has been reset.');});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const name=$('name').value.trim(); const price=Number($('price').value); const editingId=$('edit-id').value;
    if (!name || !Number.isFinite(price) || price<0) { status('Please enter a valid product name and price.'); return; }
    let id=editingId || slugify(name); let suffix=2;
    while (!editingId && products.some(p=>p.id===id)) id=`${slugify(name)}-${suffix++}`;
    const oldProduct=editingId ? products.find(p=>p.id===editingId) : null;
    let images=lines($('image-urls').value);
    // Newly uploaded images are added to the end of the gallery; if none are entered, keep existing images while editing.
    if (uploadedImages.length) images=images.concat(uploadedImages);
    if (!images.length && oldProduct) images=[...(oldProduct.gallery||[]),oldProduct.image].filter(Boolean);
    images=[...new Set(images)];
    const product={
      id,name,brand:$('brand').value.trim(),category:$('category').value.trim()||'IEM',price,
      oldPrice:$('old-price').value===''?null:Number($('old-price').value),currency:$('currency').value,
      subtitle:$('subtitle').value.trim(),shortDescription:$('short-description').value.trim(),
      image:images[0]||'',gallery:images,colors:lines($('colors').value),features:lines($('features').value),
      specifications:specLines($('specifications').value).map(s=>({label:s.label,value:s.value})),
      description:pairLines($('description').value).map(s=>({title:s.title,content:s.content})),
      related:oldProduct?.related||[],stock:oldProduct?.stock??null
    };
    try {
      await ProductStore.save(product); await refresh(); resetForm(); status(`Saved “${name}”. The product list and detail page will now use this updated data.`);
    } catch (error) { console.error(error); status('Could not save the product. An image may be too large; try a smaller image or use an image URL instead.'); }
  });

  try { await ProductStore.seedIfEmpty(); await refresh(); }
  catch(error) { console.error(error); status('Could not connect to the database. Run `npm start` in the terminal and open http://localhost:3000.'); }
})();
