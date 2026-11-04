import DataGate from '../components/DataGate';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductGrid from '../components/ProductGrid';
import EmptyState from '../components/EmptyState';
import { GENDERS, familiesOf, matchesQuery } from '../data/products';
import { useShop } from '../context/ShopContext';

const HEADINGS = {
  All: ['The Fragrance Collection', 'Find the notes, moods and moments that feel like you.'],
  Her: ['Fragrances for Her', 'An exploration of softness, confidence and unforgettable character.'],
  Him: ['Fragrances for Him', 'Compositions of depth, distinction and effortless presence.'],
  Unisex: ['Fragrances Without Boundaries', 'Beautifully balanced scents, made to be worn your way.'],
};
const SORTS = {
  featured: 'Featured',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  name: 'Name: A to Z',
  rating: 'Best Rated',
};
const sorters = {
  featured: () => 0,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0),
};

function CollectionInner() {
  const [params, setParams] = useSearchParams();
  const { products } = useShop();
  const FAMILIES = useMemo(() => familiesOf(products), [products]);
  const [drawer, setDrawer] = useState(false);

  // All filter state lives in the URL, so it survives refresh and deep links.
  const g = params.get('gender');
  const gender = GENDERS.includes(g) ? g : 'All';
  const best = params.get('best') === '1';
  const families = (params.get('family') || '').split(',').filter((f) => FAMILIES.includes(f));
  const q = params.get('q') || '';
  const sort = sorters[params.get('sort')] ? params.get('sort') : 'featured';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      const empty = v === null || v === '' || v === false || v === 'All' || (k === 'sort' && v === 'featured') || (Array.isArray(v) && !v.length);
      if (empty) next.delete(k); else next.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : v);
    });
    setParams(next, { replace: true });
  };
  const toggleFamily = (f) => update({ family: families.includes(f) ? families.filter((x) => x !== f) : [...families, f] });
  const clearAll = () => setParams({}, { replace: true });

  const items = useMemo(() => products
    .filter((p) => (gender === 'All' || p.gender === gender)
      && (!families.length || families.includes(p.family))
      && (!best || p.bestseller)
      && matchesQuery(p, q))
    .sort(sorters[sort]), [products, gender, families.join(','), best, q, sort]);

  const chips = [
    gender !== 'All' && { label: `For ${gender}`, remove: () => update({ gender: null }) },
    ...families.map((f) => ({ label: f, remove: () => toggleFamily(f) })),
    best && { label: 'Bestsellers', remove: () => update({ best: false }) },
    q && { label: `“${q}”`, remove: () => update({ q: '' }) },
  ].filter(Boolean);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const [title, sub] = HEADINGS[gender];

  const renderFilters = (group) => (
    <>
      <fieldset>
        <legend className="label">Gender</legend>
        {['All', ...GENDERS].map((x) => (
          <label key={x} className="opt"><input type="radio" name={`gender-${group}`} checked={gender === x} onChange={() => update({ gender: x })} />
            <span>{x === 'All' ? 'All' : x === 'Unisex' ? 'Unisex' : `For ${x}`}</span></label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="label">Fragrance family</legend>
        {FAMILIES.map((f) => (
          <label key={f} className="opt"><input type="checkbox" checked={families.includes(f)} onChange={() => toggleFamily(f)} /><span>{f}</span></label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="label">Refine</legend>
        <label className="opt"><input type="checkbox" checked={best} onChange={(e) => update({ best: e.target.checked })} /><span>Bestsellers only</span></label>
      </fieldset>
      <button type="button" className="btn btn-outline btn-block" onClick={clearAll} disabled={!chips.length && sort === 'featured'}>Clear All Filters</button>
    </>
  );

  return (
    <div className="container page-pad">
      <header className="section-head center">
        <p className="label">Collection</p>
        <h1>{title}</h1>
        <p className="lead">{sub}</p>
      </header>

      <div className="toolbar">
        <div className="search-inline">
          <Search size={17} aria-hidden="true" />
          <label htmlFor="c-q" className="sr">Search the collection</label>
          <input id="c-q" type="search" placeholder="Search names, notes, families" value={q} onChange={(e) => update({ q: e.target.value })} />
        </div>
        <button type="button" className="btn btn-outline filter-btn" onClick={() => setDrawer(true)}><SlidersHorizontal size={16} /> Filters{chips.length ? ` (${chips.length})` : ''}</button>
        <label className="sort"><span className="sr">Sort by</span>
          <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      <div className="coll-layout">
        <aside className="filters" aria-label="Filters">{renderFilters('side')}</aside>
        <div>
          <div className="coll-meta">
            <p className="count" aria-live="polite">{items.length} {items.length === 1 ? 'fragrance' : 'fragrances'}</p>
            {chips.length > 0 && (
              <ul className="chips">
                {chips.map((c) => (
                  <li key={c.label}><button type="button" className="chip on" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>{c.label} <X size={13} /></button></li>
                ))}
              </ul>
            )}
          </div>
          {items.length ? <ProductGrid items={items} cols={3} /> : (
            <EmptyState title="No fragrances match." text="Try removing a filter or searching for a different note.">
              <button type="button" className="btn" onClick={clearAll}>Clear All Filters</button>
            </EmptyState>
          )}
        </div>
      </div>

      <div className={`sheet-backdrop ${drawer ? 'open' : ''}`} onClick={() => setDrawer(false)} />
      <div className={`sheet ${drawer ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Filters" aria-hidden={!drawer}>
        <div className="sheet-head"><h2>Filters</h2><button type="button" onClick={() => setDrawer(false)} aria-label="Close filters"><X size={22} /></button></div>
        <div className="sheet-body">{renderFilters('sheet')}</div>
        <button type="button" className="btn btn-block" onClick={() => setDrawer(false)}>Show {items.length} {items.length === 1 ? 'fragrance' : 'fragrances'}</button>
      </div>
    </div>
  );
}

export default function Collection() {
  return <DataGate><CollectionInner /></DataGate>;
}
