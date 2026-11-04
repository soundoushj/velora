// Thin client for the Velora REST API.
// =====================================================
// USER ACTION REQUIRED
// TODO: START THE BACKEND (cd backend && npm run dev) BEFORE OPENING THE SHOP.
// TODO: IF THE BACKEND IS NOT ON http://localhost:5000, SET VITE_API_URL IN frontend/.env
// =====================================================
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

export async function request(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, signal, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'We could not reach the Velora server. Please check your connection and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const message = res.status === 429
      ? 'Too many requests. Please wait a few minutes and try again.'
      : (data && data.message) || `Something went wrong (error ${res.status}).`;
    throw new ApiError(res.status, message, data && data.errors);
  }
  return data;
}

// The API returns MongoDB documents; the UI was built around the original catalogue shape.
// This adapter keeps every component unchanged: `id` stays the original Velora id (the "slug").
export const normalizeProduct = (p) => ({
  id: p.slug,
  _id: p._id,
  brand: p.brand,
  name: p.name,
  gender: p.gender,
  family: p.family,
  familyLabel: p.familyLabel || p.family,
  type: p.category,
  price: p.price,
  size: p.size,
  bestseller: p.bestseller,
  featured: p.featured,
  description: p.description,
  smellsLike: p.smellsLike || '',
  notes: { top: p.notes?.top || [], heart: p.notes?.heart || [], base: p.notes?.base || [] },
  image: p.imageUrl,
  stock: p.stock,
});

/** Fetches the whole catalogue (the API is paginated, so we follow the pages). */
export async function fetchAllProducts(signal) {
  const first = await request('/products?limit=100&page=1', { signal });
  let items = first.data;
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await request(`/products?limit=100&page=${page}`, { signal });
    items = items.concat(next.data);
  }
  return items.map(normalizeProduct);
}
