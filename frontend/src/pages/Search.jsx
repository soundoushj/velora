import DataGate from '../components/DataGate';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import ProductImage from '../components/ProductImage';
import { familiesOf, formatPrice, matchesQuery } from '../data/products';
import { useShop } from '../context/ShopContext';

function SearchInner() {
  const [params, setParams] = useSearchParams();
  const { products } = useShop();
  const FAMILIES = familiesOf(products);
  const q = params.get('q') || '';
  const setQ = (v) => setParams(v ? { q: v } : {}, { replace: true });
  const results = q.trim() ? products.filter((p) => matchesQuery(p, q)) : [];
  const suggested = products.filter((p) => p.bestseller).slice(0, 4);

  return (
    <div className="container narrow page-pad">
      <header className="center section-head">
        <p className="label">Search</p>
        <h1>Find your fragrance</h1>
      </header>
      <form role="search" className="search-box" onSubmit={(e) => { e.preventDefault(); e.currentTarget.querySelector('input').blur(); }}>
        <SearchIcon size={20} aria-hidden="true" />
        <label htmlFor="q" className="sr">Search fragrances</label>
        <input id="q" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rose, oud, citrus, for her..." autoComplete="off" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={18} /></button>}
      </form>

      {!q.trim() && (
        <div className="suggest">
          <p className="label">Browse by family</p>
          <div className="chips">{FAMILIES.map((f) => <button key={f} type="button" className="chip" onClick={() => setQ(f)}>{f}</button>)}</div>
          <p className="label mt">Suggested for you</p>
          <ResultList items={suggested} />
        </div>
      )}
      {q.trim() && (
        <div className="suggest" aria-live="polite">
          <p className="count">{results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”</p>
          {results.length ? <ResultList items={results} /> : (
            <div className="empty small-empty">
              <h2>No fragrances found.</h2>
              <p>Try a note such as “rose” or “amber”, or a family such as “woody”.</p>
              <button type="button" className="btn btn-outline" onClick={() => setQ('')}>Clear search</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultList({ items }) {
  return (
    <ul className="results">
      {items.map((p) => (
        <li key={p.id}>
          <Link to={`/product/${p.id}`}>
            <span className="res-img"><ProductImage product={p} compact /></span>
            <span className="res-info">
              <span className="res-name">{p.name}</span>
              <span className="label">{p.brand} · {p.family} · {p.gender}</span>
            </span>
            <span className="price">{formatPrice(p.price)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Search() {
  return <DataGate><SearchInner /></DataGate>;
}
