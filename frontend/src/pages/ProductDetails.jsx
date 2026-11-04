import DataGate from '../components/DataGate';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import ProductImage from '../components/ProductImage';
import QuantitySelector from '../components/QuantitySelector';
import ProductGrid from '../components/ProductGrid';
import EmptyState from '../components/EmptyState';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../data/products';

function ProductDetailsInner() {
  const { id } = useParams();
  const { isFavorite, toggleFavorite, addToBag, getProduct, products } = useShop();
  const product = getProduct(id);
  const [qty, setQty] = useState(1);

  if (!product) {
    return <div className="container page-pad"><EmptyState title="Fragrance not found." text="We could not find that fragrance. It may have been retired from the collection." cta="Explore the Collection" /></div>;
  }
  const fav = isFavorite(product.id);
  const related = [...products.filter((p) => p.id !== product.id)]
    .sort((a, b) => (Number(b.family === product.family) * 2 + Number(b.gender === product.gender)) - (Number(a.family === product.family) * 2 + Number(a.gender === product.gender)))
    .slice(0, 4);

  return (
    <div className="container page-pad">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/collection">Collection</Link> / <Link to={`/collection?gender=${product.gender}`}>{product.gender}</Link> / <span>{product.name}</span></nav>
      <div className="pd" key={product.id}>
        <div className="pd-media"><ProductImage product={product} /></div>
        <div className="pd-info">
          <p className="label">{product.brand} · {product.familyLabel} · {product.gender}</p>
          <h1>{product.name}</h1>
          {product.rating && <p className="pcard-rating"><Star size={14} fill="currentColor" aria-hidden="true" /> {product.rating.toFixed(1)} <span>({product.reviewCount} reviews)</span></p>}
          <p className="pd-price">{formatPrice(product.price)}</p>
          <p className="lead">{product.description}</p>

          <div className="pd-block"><p className="label">Smells like</p><p className="pd-smells">{product.smellsLike}</p></div>
          <dl className="notes">
            <div><dt className="label">Top notes</dt><dd>{product.notes.top.join(', ')}</dd></div>
            <div><dt className="label">Heart notes</dt><dd>{product.notes.heart.join(', ')}</dd></div>
            <div><dt className="label">Base notes</dt><dd>{product.notes.base.join(', ')}</dd></div>
            <div><dt className="label">Volume</dt><dd>{product.size} · {product.type}</dd></div>
          </dl>

          <div className="pd-actions">
            <QuantitySelector value={qty} onDecrease={() => setQty((q) => Math.max(1, q - 1))} onIncrease={() => setQty((q) => q + 1)} />
            <button type="button" className="btn" disabled={product.stock === 0} onClick={() => { addToBag(product.id, qty); setQty(1); }}>{product.stock === 0 ? 'Out of Stock' : 'Add to Bag'}</button>
            <button type="button" className={`heart inline ${fav ? 'on' : ''}`} onClick={() => toggleFavorite(product.id)} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Save to favorites'}>
              <Heart size={20} fill={fav ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
      <section className="section-tight" aria-labelledby="rel">
        <h2 id="rel" className="center">You may also love</h2>
        <ProductGrid items={related} />
      </section>
    </div>
  );
}

export default function ProductDetails() {
  return <DataGate><ProductDetailsInner /></DataGate>;
}
