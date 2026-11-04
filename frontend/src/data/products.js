// The product catalogue now lives in MongoDB and is served by the Velora API (see services/api.js).
// This file keeps only the shared constants and helper functions the shop UI uses.
export const GENDERS = ['Her', 'Him', 'Unisex'];
export const FAMILY_ORDER = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Gourmand', 'Musky'];

// Only offer filter families that actually have products.
export const familiesOf = (products) => FAMILY_ORDER.filter((f) => products.some((p) => p.family === f));

const haystack = (p) =>
  [p.brand || 'Velora', p.name, p.familyLabel || '', p.gender, `for ${p.gender}`, p.family, p.description, p.smellsLike, ...p.notes.top, ...p.notes.heart, ...p.notes.base]
    .join(' ').toLowerCase();

export const matchesQuery = (p, q) => {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const h = haystack(p);
  return terms.every((t) => h.includes(t));
};

export const formatPrice = (n) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} DZD`;
