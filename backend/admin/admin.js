/* Velora administration dashboard.
 * Plain JavaScript (no build step). All text from the server is inserted with textContent / text nodes,
 * never innerHTML, so a malicious product name cannot run script in the dashboard.
 * Security note: this file only DISPLAYS things. Every action is re-checked by the API
 * (JWT + administrator role), so editing this file in the browser gives an attacker nothing.
 */
(() => {
  'use strict';

  const TOKEN_KEY = 'velora:admin:token'; // sessionStorage: cleared when the tab is closed
  const GENDERS = ['Her', 'Him', 'Unisex'];
  const FAMILIES = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Gourmand', 'Musky'];
  const PAGE_SIZE = 15;
  const state = { user: null, frontendUrl: '', lowStock: 5, view: 0 };

  // ---------- tiny helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }
  const money = (n) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} DZD`;
  const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateTime = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function toast(message, type = 'success') {
    const el = h('div', { class: `toast ${type === 'error' ? 'error' : ''}`, text: message });
    $('#toasts').append(el);
    setTimeout(() => el.remove(), type === 'error' ? 6500 : 3500);
  }

  class ApiError extends Error {
    constructor(status, message, errors) { super(message); this.status = status; this.errors = errors || []; }
  }

  async function api(path, { method = 'GET', body, noAutoLogout = false } = {}) {
    const headers = { Accept: 'application/json' };
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }
    if (!res.ok) {
      if (res.status === 401 && !noAutoLogout) signOut('Your session has expired. Please sign in again.');
      if (res.status === 429) throw new ApiError(429, 'Too many requests. Please wait a few minutes and try again.');
      throw new ApiError(res.status, (data && data.message) || `Request failed (${res.status}).`, data && data.errors);
    }
    return data;
  }
  const showErr = (err) => toast(err.message || 'Something went wrong.', 'error');
  const query = (obj) => {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, v); });
    return p.toString();
  };

  // ---------- shared UI pieces ----------
  function imgSrc(url) {
    if (!url) return '';
    if (url.startsWith('/')) return state.frontendUrl + url; // shop-relative path -> shop origin
    return /^https?:\/\//i.test(url) ? url : '';
  }
  function thumb(p) {
    const src = imgSrc(p.imageUrl);
    const fallback = () => h('div', { class: 'thumb', 'aria-hidden': 'true', text: (p.name || '?').charAt(0).toUpperCase() });
    if (!src) return fallback();
    const img = h('img', { class: 'thumb', src, alt: '', loading: 'lazy', width: 46, height: 46 });
    img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
    return img;
  }
  const stockBadge = (n) => {
    if (n === 0) return h('span', { class: 'badge danger', text: 'Out of stock' });
    if (n <= state.lowStock) return h('span', { class: 'badge warn', text: 'Low stock' });
    return h('span', { class: 'badge ok', text: 'In stock' });
  };

  /** Inline "stock quantity" editor used in the overview and the product table. */
  function stockEditor(product, onSaved) {
    const input = h('input', { type: 'number', min: 0, step: 1, value: product.stock, 'aria-label': `Stock for ${product.name}` });
    const save = h('button', { class: 'btn btn-small', type: 'button', disabled: true, text: 'Save' });
    input.addEventListener('input', () => { save.disabled = String(product.stock) === input.value.trim() || input.value.trim() === ''; });
    const commit = async () => {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 0 || value > 100000) return toast('Stock must be a whole number between 0 and 100,000.', 'error');
      save.disabled = true;
      try {
        const res = await api(`/products/${product._id}/stock`, { method: 'PATCH', body: { stock: value } });
        toast(`Stock for “${product.name}” set to ${res.data.stock}.`);
        onSaved(res.data);
      } catch (err) { showErr(err); save.disabled = false; }
    };
    save.addEventListener('click', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!save.disabled) commit(); } });
    return h('div', { class: 'stock-edit' }, input, save);
  }

  function pager(container, { page, pages, total }, go, noun) {
    container.append(h('div', { class: 'pager' },
      h('span', { text: `${total} ${noun}${total === 1 ? '' : 's'} · page ${page} of ${pages}` }),
      h('div', {},
        h('button', { class: 'btn btn-outline btn-small', type: 'button', disabled: page <= 1, onclick: () => go(page - 1), text: 'Previous' }),
        h('button', { class: 'btn btn-outline btn-small', type: 'button', disabled: page >= pages, onclick: () => go(page + 1), text: 'Next' }))));
  }

  // ---------- authentication ----------
  function showLogin(message) {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    const box = $('#login-error');
    box.hidden = !message;
    box.textContent = message || '';
    document.title = 'Sign in · Velora Administration';
    $('#login-email').focus();
  }
  function showApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#whoami').textContent = `${state.user.name} · ${state.user.email}`;
    route();
  }
  function signOut(message) {
    sessionStorage.removeItem(TOKEN_KEY);
    state.user = null;
    history.replaceState(null, '', location.pathname);
    showLogin(message);
  }

  function setFieldError(form, name, message) {
    const p = $(`.field-error[data-for="${name}"]`, form);
    const input = form.elements[name];
    if (p) { p.textContent = message || ''; p.hidden = !message; }
    if (input && input.setAttribute) { if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    $('#login-error').hidden = true;
    let ok = true;
    setFieldError(form, 'email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
    setFieldError(form, 'password', !password ? 'Enter your password.' : '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) ok = false;
    if (!ok) return;

    const button = $('#login-button');
    button.disabled = true; button.textContent = 'Signing in…';
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email, password }, noAutoLogout: true });
      if (res.data.user.role !== 'admin') {
        // A valid customer account must not enter the back office. The token is discarded immediately.
        throw new ApiError(403, 'This account does not have administrator access.');
      }
      sessionStorage.setItem(TOKEN_KEY, res.data.token);
      state.user = res.data.user;
      form.reset();
      showApp();
    } catch (err) {
      const box = $('#login-error');
      box.textContent = err.message; box.hidden = false;
    } finally {
      button.disabled = false; button.textContent = 'Sign in';
    }
  });
  $('#logout-button').addEventListener('click', () => { signOut(); toast('You have been signed out.'); });

  // ---------- router ----------
  const routes = { overview: renderOverview, products: renderProducts, orders: renderOrders, customers: renderCustomers };
  function route() {
    if (!state.user) return;
    const name = (location.hash.replace(/^#\//, '') || 'overview').split('?')[0];
    const key = routes[name] ? name : 'overview';
    $$('.sidebar nav a').forEach((a) => (a.dataset.route === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const view = ++state.view;
    const content = $('#content');
    content.replaceChildren(h('p', { class: 'loading', text: 'Loading…' }));
    routes[key](content, () => view === state.view); // 2nd arg: "is this still the current view?"
    document.title = `${{ overview: 'Overview', products: 'Perfumes', orders: 'Orders', customers: 'Customers' }[key]} · Velora Administration`;
  }
  window.addEventListener('hashchange', route);

  const errorBox = (container, err) => container.replaceChildren(h('div', { class: 'error-box', role: 'alert' }, h('strong', { text: 'Could not load this page. ' }), err.message,
    h('p', {}, h('button', { class: 'link-btn', type: 'button', onclick: route, text: 'Try again' }))));

  // ---------- overview ----------
  async function renderOverview(root, isCurrent) {
    let s;
    try { s = (await api('/admin/stats')).data; } catch (err) { if (isCurrent()) errorBox(root, err); return; }
    if (!isCurrent()) return;
    const inv = s.inventory;
    const stat = (value, label, cls = '', unit = '') => h('div', { class: `stat ${cls}` }, h('div', { class: 'stat-value' }, String(value), unit && h('small', { text: unit })), h('div', { class: 'stat-label', text: label }));

    const bars = (title, map, order) => {
      const max = Math.max(1, ...Object.values(map));
      return [h('h3', { text: title }), h('div', { class: 'bars' }, order.filter((k) => map[k]).map((k) => {
        const fill = h('div', { class: 'bar-fill' });
        fill.style.width = `${(map[k] / max) * 100}%`;
        return h('div', { class: 'bar-row' }, h('span', { text: k }), h('div', { class: 'bar-track' }, fill), h('span', { class: 'num', text: map[k] }));
      }))];
    };

    const restock = inv.lowStockItems.length
      ? h('ul', { class: 'restock' }, inv.lowStockItems.map((p) => h('li', {},
          thumb(p),
          h('div', {}, h('div', { class: 'name', text: p.name }), h('div', { class: 'muted', text: p.brand }), stockBadge(p.stock)),
          stockEditor(p, () => route()))))
      : h('p', { class: 'muted', text: `Every perfume has more than ${inv.lowStockThreshold} units in stock.` });

    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', { text: `Welcome back, ${state.user.name.split(' ')[0]}` }), h('p', { class: 'muted', text: 'A snapshot of the Velora catalogue and community.' }))),
      h('section', { class: 'stats', 'aria-label': 'Key figures' },
        stat(s.totalProducts, 'Perfumes in the catalogue'),
                stat(s.totalCustomers, 'Customers who have ordered'),
        stat(inv.totalUnits, 'Units in stock'),
        stat(new Intl.NumberFormat('en-US').format(inv.inventoryValue), 'Inventory value at shop prices', '', 'DZD'),
        stat(inv.lowStock, `Low stock (${inv.lowStockThreshold} units or fewer)`, inv.lowStock ? 'warn' : ''),
        stat(inv.outOfStock, 'Out of stock', inv.outOfStock ? 'alert' : '')),
      h('div', { class: 'cols' },
        h('section', { class: 'panel' }, h('h3', { text: 'Needs restocking' }), restock),
        h('section', { class: 'panel' }, bars('By audience', s.byGender, GENDERS), bars('By fragrance family', s.byFamily, FAMILIES))));
  }

  // ---------- products ----------
  const pq = { search: '', gender: '', family: '', stockLevel: '', sort: 'featured', page: 1 };

  function select(name, label, options, value, onChange) {
    const sel = h('select', { 'aria-label': label }, h('option', { value: '', text: label }), options.map(([v, t]) => h('option', { value: v, text: t })));
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function renderProducts(root, isCurrent) {
    const results = h('div', { 'aria-live': 'polite' });
    const search = h('input', { type: 'search', placeholder: 'Search by name, brand or notes…', value: pq.search, 'aria-label': 'Search perfumes', maxlength: 100 });
    search.addEventListener('input', debounce(() => { pq.search = search.value.trim(); pq.page = 1; load(); }));
    const set = (key) => (v) => { pq[key] = v; pq.page = 1; load(); };

    root.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', { text: 'Perfumes' }), h('p', { class: 'muted', text: 'Add, edit, restock and remove fragrances.' })),
        h('button', { class: 'btn', type: 'button', onclick: () => openProductDialog(null, load), text: 'Add perfume' })),
      h('div', { class: 'toolbar' },
        h('div', { class: 'grow' }, search),
        select('gender', 'All audiences', GENDERS.map((g) => [g, g]), pq.gender, set('gender')),
        select('family', 'All families', FAMILIES.map((f) => [f, f]), pq.family, set('family')),
        select('stock', 'Any stock level', [['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock']], pq.stockLevel, set('stockLevel')),
        select('sort', 'Sort', [['featured', 'Shop order'], ['name', 'Name A–Z'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['stock-asc', 'Stock: lowest first'], ['newest', 'Newest']], pq.sort, (v) => { pq.sort = v || 'featured'; pq.page = 1; load(); })),
      results);

    async function load() {
      results.replaceChildren(h('p', { class: 'loading', text: 'Loading…' }));
      try {
        const res = await api(`/products?${query({ ...pq, limit: PAGE_SIZE })}`);
        if (!isCurrent()) return;
        if (res.page > res.pages) { pq.page = res.pages; return load(); }
        draw(res);
      } catch (err) { if (isCurrent()) results.replaceChildren(h('div', { class: 'error-box', role: 'alert' }, err.message)); }
    }

    function draw(res) {
      if (!res.data.length) return results.replaceChildren(h('div', { class: 'table-wrap' }, h('p', { class: 'empty', text: 'No perfumes match these filters.' })));
      const rows = res.data.map((p) => h('tr', {},
        h('td', {}, h('div', { class: 'cell-product' }, thumb(p), h('div', {}, h('div', { class: 'name', text: p.name }), h('div', { class: 'sub', text: `${p.brand} · ${p.size || ''}` })))),
        h('td', {}, h('span', { class: 'badge', text: p.gender }), ' ', h('span', { class: 'badge gold', text: p.family })),
        h('td', { text: p.category }),
        h('td', { class: 'num', text: money(p.price) }),
        h('td', {}, h('div', {}, stockEditor(p, () => load())), h('div', { class: 'hint' }, stockBadge(p.stock))),
        h('td', { class: 'actions' },
          h('button', { class: 'link-btn', type: 'button', onclick: () => openProductDialog(p, load), 'aria-label': `Edit ${p.name}`, text: 'Edit' }), ' ',
          h('button', { class: 'link-btn danger', type: 'button', onclick: () => confirmDelete(p, load), 'aria-label': `Delete ${p.name}`, text: 'Delete' }))));
      const table = h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Perfume', 'Audience & family', 'Category'].map((t) => h('th', { text: t })), h('th', { class: 'num', text: 'Price' }), h('th', { text: 'Stock' }), h('th', { text: 'Actions' }))),
        h('tbody', {}, rows)));
      results.replaceChildren(table);
      pager(results, res, (page) => { pq.page = page; load(); }, 'perfume');
    }
    load();
  }

  // ----- add / edit dialog -----
  const dialog = $('#product-dialog');
  const form = $('#product-form');
  let editing = null; let afterSave = () => {};
  const fill = (sel, values) => sel.replaceChildren(h('option', { value: '', text: 'Choose…' }), ...values.map((v) => h('option', { value: v, text: v })));
  fill(form.elements.gender, GENDERS); fill(form.elements.family, FAMILIES);
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));

  const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  function openProductDialog(product, done) {
    editing = product; afterSave = done;
    form.reset();
    $$('.field-error', form).forEach((p) => { p.hidden = true; });
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    $('#product-error').hidden = true;
    $('#product-dialog-title').textContent = product ? `Edit “${product.name}”` : 'Add perfume';
    const f = form.elements;
    if (product) {
      ['name', 'brand', 'category', 'price', 'stock', 'gender', 'family', 'familyLabel', 'size', 'description', 'smellsLike', 'imageUrl'].forEach((k) => { f[k].value = product[k] ?? ''; });
      f.top.value = (product.notes?.top || []).join(', '); f.heart.value = (product.notes?.heart || []).join(', '); f.base.value = (product.notes?.base || []).join(', ');
      f.bestseller.checked = !!product.bestseller; f.featured.checked = !!product.featured;
    } else {
      f.brand.value = 'Velora'; f.size.value = '100 ml'; f.stock.value = 0; f.category.value = 'Eau de parfum';
    }
    dialog.showModal();
    f.name.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const v = (k) => f[k].value.trim();
    const checks = {
      name: v('name').length < 2 ? 'Enter a name (2+ characters).' : '',
      category: v('category').length < 2 ? 'Enter a category.' : '',
      description: v('description').length < 10 ? 'Description must be at least 10 characters.' : '',
      price: v('price') === '' || Number(v('price')) < 0 ? 'Enter a price of 0 or more.' : '',
      stock: !/^\d+$/.test(v('stock')) ? 'Stock must be a whole number.' : '',
      gender: !v('gender') ? 'Choose an audience.' : '',
      family: !v('family') ? 'Choose a fragrance family.' : '',
    };
    $('#product-error').hidden = true;
    ['name', 'brand', 'category', 'price', 'stock', 'gender', 'family', 'familyLabel', 'size', 'description', 'smellsLike', 'imageUrl'].forEach((k) => setFieldError(form, k, checks[k] || ''));
    if (Object.values(checks).some(Boolean)) return;

    const body = {
      name: v('name'), brand: v('brand') || 'Velora', category: v('category'), description: v('description'),
      price: Number(v('price')), stock: Number(v('stock')), gender: v('gender'), family: v('family'),
      familyLabel: v('familyLabel'), size: v('size') || '100 ml', smellsLike: v('smellsLike'),
      bestseller: f.bestseller.checked, featured: f.featured.checked,
      notes: { top: csv(v('top')), heart: csv(v('heart')), base: csv(v('base')) },
    };
    if (editing || v('imageUrl')) body.imageUrl = v('imageUrl');

    const save = $('#product-save');
    save.disabled = true; save.textContent = 'Saving…';
    try {
      const res = editing
        ? await api(`/products/${editing._id}`, { method: 'PUT', body })
        : await api('/products', { method: 'POST', body });
      toast(editing ? `“${res.data.name}” updated.` : `“${res.data.name}” added to the collection.`);
      dialog.close();
      afterSave();
    } catch (err) {
      const box = $('#product-error');
      box.textContent = err.errors.length ? 'Please correct the highlighted fields.' : err.message;
      box.hidden = false;
      err.errors.forEach((x) => setFieldError(form, x.field, x.message));
    } finally { save.disabled = false; save.textContent = 'Save perfume'; }
  });

  // ----- delete confirmation -----
  const confirmDialog = $('#confirm-dialog');
  $$('[data-close]', confirmDialog).forEach((b) => b.addEventListener('click', () => confirmDialog.close()));
  function confirmDelete(product, done) {
    $('#confirm-text').textContent = `“${product.name}” will be permanently removed from the shop. This cannot be undone.`;
    const ok = $('#confirm-ok');
    const fresh = ok.cloneNode(true); // drop listeners from a previous product
    ok.replaceWith(fresh);
    fresh.addEventListener('click', async () => {
      fresh.disabled = true;
      try {
        await api(`/products/${product._id}`, { method: 'DELETE' });
        toast(`“${product.name}” deleted.`);
        confirmDialog.close();
        done();
      } catch (err) { showErr(err); confirmDialog.close(); }
    });
    confirmDialog.showModal();
  }

  // ---------- orders ----------
  const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
  const STATUS_CLASS = { pending: 'warn', confirmed: 'gold', shipped: '', delivered: 'ok', cancelled: 'danger' };
  // Same rules as the API (the API is the one that really enforces them): final statuses have no next step.
  const NEXT_STATUS = { pending: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'], shipped: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
  const statusBadge = (st) => h('span', { class: `badge ${STATUS_CLASS[st] || ''}`, text: STATUS_LABEL[st] || st });
  const paymentLabel = { cash_on_delivery: 'Cash on delivery' };
  const oq = { search: '', status: '', page: 1 };

  function renderOrders(root, isCurrent) {
    const results = h('div', { 'aria-live': 'polite' });
    const search = h('input', { type: 'search', placeholder: 'Search by order number, name, phone or city…', value: oq.search, 'aria-label': 'Search orders', maxlength: 100 });
    search.addEventListener('input', debounce(() => { oq.search = search.value.trim(); oq.page = 1; load(); }));
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', { text: 'Orders' }), h('p', { class: 'muted', text: 'Cash-on-delivery orders placed in the shop, newest first.' }))),
      h('div', { class: 'toolbar' }, h('div', { class: 'grow' }, search),
        select('status', 'All statuses', ORDER_STATUSES.map((st) => [st, STATUS_LABEL[st]]), oq.status, (v) => { oq.status = v; oq.page = 1; load(); })),
      results);

    async function load() {
      results.replaceChildren(h('p', { class: 'loading', text: 'Loading…' }));
      try {
        const res = await api(`/orders?${query({ ...oq, limit: PAGE_SIZE })}`);
        if (!isCurrent()) return;
        if (res.page > res.pages) { oq.page = res.pages; return load(); }
        if (!res.data.length) return results.replaceChildren(h('div', { class: 'table-wrap' }, h('p', { class: 'empty', text: oq.search || oq.status ? 'No orders match these filters.' : 'No orders yet. They will appear here as soon as a customer checks out.' })));
        results.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Order', 'Customer', 'Phone', 'City', 'Date'].map((t) => h('th', { text: t })), h('th', { class: 'num', text: 'Total' }), h('th', { text: 'Status' }), h('th', { text: 'Actions' }))),
          h('tbody', {}, res.data.map((o) => h('tr', {},
            h('td', {}, h('strong', { text: o.orderNumber })),
            h('td', { text: o.customer.fullName }), h('td', { text: o.customer.phone }), h('td', { text: o.customer.city }),
            h('td', { text: dateTime(o.createdAt) }),
            h('td', { class: 'num', text: money(o.total) }),
            h('td', {}, statusBadge(o.status)),
            h('td', { class: 'actions' }, h('button', { class: 'link-btn', type: 'button', onclick: () => openOrderDialog(o._id, load), 'aria-label': `View order ${o.orderNumber}`, text: 'View' }))))))));
        pager(results, res, (page) => { oq.page = page; load(); }, 'order');
      } catch (err) { if (isCurrent()) results.replaceChildren(h('div', { class: 'error-box', role: 'alert' }, err.message)); }
    }
    load();
  }

  const orderDialog = $('#order-dialog');

  async function openOrderDialog(id, onChanged) {
    const body = $('#order-detail');
    body.replaceChildren(h('p', { class: 'loading', text: 'Loading…' }));
    if (!orderDialog.open) orderDialog.showModal();
    try {
      const res = await api(`/orders/${id}`);
      drawOrder(res.data, onChanged);
    } catch (err) {
      body.replaceChildren(h('div', { class: 'error-box', role: 'alert', text: err.message }));
    }
  }

  function drawOrder(order, onChanged) {
    const row = (label, value) => h('div', { class: 'kv' }, h('dt', { text: label }), h('dd', {}, value));
    const next = NEXT_STATUS[order.status] || [];

    // ----- status control (two clicks to cancel) -----
    let control;
    if (!next.length) {
      control = h('p', { class: 'muted', text: `This order is ${STATUS_LABEL[order.status].toLowerCase()}; its status can no longer be changed.` });
    } else {
      const sel = h('select', { id: 'order-next', 'aria-label': 'New status' }, next.map((st) => h('option', { value: st, text: STATUS_LABEL[st] })));
      const hint = h('p', { class: 'hint', hidden: true, text: 'Cancelling returns the reserved stock to the shop and cannot be undone. Click again to confirm.' });
      const btn = h('button', { class: 'btn', type: 'button', text: 'Update status' });
      let armed = false;
      const reset = () => { armed = false; hint.hidden = true; btn.textContent = 'Update status'; btn.classList.remove('btn-danger'); };
      sel.addEventListener('change', reset);
      btn.addEventListener('click', async () => {
        const status = sel.value;
        if (status === 'cancelled' && !armed) {
          armed = true; hint.hidden = false; btn.textContent = 'Confirm cancellation'; btn.classList.add('btn-danger');
          return;
        }
        btn.disabled = true; sel.disabled = true;
        try {
          const res = await api(`/orders/${order._id}/status`, { method: 'PATCH', body: { status } });
          toast(`Order ${order.orderNumber} is now ${STATUS_LABEL[res.data.status].toLowerCase()}.`);
          drawOrder(res.data, onChanged);
          onChanged();
        } catch (err) { showErr(err); btn.disabled = false; sel.disabled = false; reset(); }
      });
      control = h('div', {}, h('div', { class: 'status-edit' }, sel, btn), hint);
    }

    $('#order-detail').replaceChildren(
      h('header', { class: 'dialog-head' },
        h('div', {}, h('h2', { id: 'order-dialog-title', text: order.orderNumber }), h('p', { class: 'muted', text: `Placed ${dateTime(order.createdAt)}` })),
        h('div', { class: 'head-right' }, statusBadge(order.status), h('button', { type: 'button', class: 'icon-btn', 'data-close': true, 'aria-label': 'Close', onclick: () => orderDialog.close(), text: '×' }))),
      h('div', { class: 'order-cols' },
        h('section', {}, h('h3', { text: 'Customer' }), h('dl', { class: 'kvs' },
          row('Name', order.customer.fullName), row('Phone', order.customer.phone), row('City', order.customer.city), row('Address', order.customer.address))),
        h('section', {}, h('h3', { text: 'Payment' }), h('dl', { class: 'kvs' },
          row('Method', paymentLabel[order.paymentMethod] || order.paymentMethod),
          row('Status', h('span', { class: `badge ${order.paymentStatus === 'paid' ? 'ok' : 'warn'}`, text: order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid' })),
          row('Last update', dateTime(order.updatedAt))))),
      h('h3', { text: 'Ordered perfumes' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'items-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Perfume' }), h('th', { class: 'num', text: 'Unit price' }), h('th', { class: 'num', text: 'Qty' }), h('th', { class: 'num', text: 'Line total' }))),
        h('tbody', {}, order.items.map((i) => h('tr', {},
          h('td', {}, h('div', { class: 'name', text: i.name }), h('div', { class: 'sub muted', text: i.slug })),
          h('td', { class: 'num', text: money(i.unitPrice) }), h('td', { class: 'num', text: i.quantity }), h('td', { class: 'num', text: money(i.lineTotal) })))))),
      h('dl', { class: 'totals' },
        h('div', {}, h('dt', { text: 'Subtotal' }), h('dd', { text: money(order.subtotal) })),
        h('div', {}, h('dt', { text: 'Delivery' }), h('dd', { text: order.deliveryFee === 0 ? 'Free' : money(order.deliveryFee) })),
        h('div', { class: 'grand' }, h('dt', { text: 'Total' }), h('dd', { text: money(order.total) }))),
      h('section', { class: 'status-box' }, h('h3', { text: 'Change status' }), control));
  }

  // ---------- customers ----------
  // Velora has no customer accounts: customers are guests, listed here from their orders (grouped by phone number).
  const uq = { search: '', page: 1 };
  function renderCustomers(root, isCurrent) {
    const results = h('div', { 'aria-live': 'polite' });
    const search = h('input', { type: 'search', placeholder: 'Search by name, phone or city…', value: uq.search, 'aria-label': 'Search customers', maxlength: 100 });
    search.addEventListener('input', debounce(() => { uq.search = search.value.trim(); uq.page = 1; load(); }));
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', { text: 'Customers' }), h('p', { class: 'muted', text: 'Everyone who has placed an order, identified by phone number. Name, city and address come from their latest order. Cancelled orders are not counted in the total spent.' }))),
      h('div', { class: 'toolbar' }, h('div', { class: 'grow' }, search)),
      results);

    async function load() {
      results.replaceChildren(h('p', { class: 'loading', text: 'Loading…' }));
      try {
        const res = await api(`/admin/customers?${query({ ...uq, limit: PAGE_SIZE })}`);
        if (!isCurrent()) return;
        if (!res.data.length) return results.replaceChildren(h('div', { class: 'table-wrap' }, h('p', { class: 'empty', text: 'No customers found.' })));
        results.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Name', 'Phone', 'City', 'Address', 'Orders', 'Total spent', 'Last order'].map((t) => h('th', { text: t })))),
          h('tbody', {}, res.data.map((c) => h('tr', {},
            h('td', { text: c.fullName }), h('td', { text: c.phone }), h('td', { text: c.city }), h('td', { text: c.address }),
            h('td', { text: String(c.ordersCount) }), h('td', { text: money(c.totalSpent) }),
            h('td', { text: date(c.lastOrderAt) })))))));
        pager(results, res, (page) => { uq.page = page; load(); }, 'customer');
      } catch (err) { if (isCurrent()) results.replaceChildren(h('div', { class: 'error-box', role: 'alert' }, err.message)); }
    }
    load();
  }

  // ---------- start-up ----------
  (async function boot() {
    try {
      const health = await api('/health', { noAutoLogout: true });
      state.frontendUrl = health.frontendUrl || '';
    } catch (err) { return showLogin(err.message); }
    if (!sessionStorage.getItem(TOKEN_KEY)) return showLogin();
    try {
      const me = await api('/auth/me', { noAutoLogout: true });
      if (me.data.user.role !== 'admin') throw new ApiError(403, 'This account does not have administrator access.');
      state.user = me.data.user;
      showApp();
    } catch (err) { signOut(err.status === 401 ? 'Your session has expired. Please sign in again.' : err.message); }
  })();
})();