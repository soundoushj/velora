import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Flower2, Heart, Leaf, Star, Trees } from 'lucide-react';
import ProductImage from './ProductImage';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../data/products';

const pair = (arr) => arr.slice(0, 2).join(' & ');

export default function ProductCard({ product, badge, index = 0 }) {
  const { isFavorite, toggleFavorite, addToBag } = useShop();
  const [added, setAdded] = useState(false);
  const fav = isFavorite(product.id);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  const notes = [
    ['Top notes', pair(product.notes.top), Leaf],
    ['Heart notes', pair(product.notes.heart), Flower2],
    ['Base notes', pair(product.notes.base), Trees],
  ];

  return (
    <article className="pcard" style={{ '--i': index }}>
      <div className="pcard-media">
        <Link to={`/product/${product.id}`} className="pcard-img" aria-label={`View ${product.name}`}>
          <ProductImage product={product} />
        </Link>
        <div className="pcard-overlay" aria-hidden="true">
          <div className="pcard-brand">
            {product.brand === 'Velora' && <span className="pcard-mono">V</span>}
            <span className="pcard-oname">{product.brand === 'Velora' ? product.name : product.brand}</span>
            <span className="pcard-oedp">{product.type}</span>
          </div>
          <p className="pcard-tagline">More than<br />a scent,<br />a feeling.<span /></p>
        </div>
        {badge && <span className="pcard-badge">{badge}</span>}
        <button type="button" className={`heart ${fav ? 'on' : ''}`} onClick={() => toggleFavorite(product.id)}
          aria-pressed={fav} aria-label={fav ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}>
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="pcard-body">
        <div className="pcard-top">
          <p className="label">{product.family} · {product.gender}</p>
          {product.rating && <p className="pcard-rating"><Star size={12} fill="currentColor" aria-hidden="true" /> {product.rating.toFixed(1)} <span>({product.reviewCount})</span></p>}
        </div>
        <p className="pcard-brandline">{product.brand}</p>
        <h3 className="pcard-name"><Link to={`/product/${product.id}`}>{product.name}</Link></h3>
        <p className="pcard-smells">{product.smellsLike}</p>
        <span className="pcard-rule" />
        <ul className="pcard-notes">
          {notes.map(([label, text, Icon]) => (
            <li key={label}>
              <span className="note-ico"><Icon size={17} strokeWidth={1.3} /></span>
              <span className="note-label">{label}</span>
              <span className="note-text">{text}</span>
            </li>
          ))}
        </ul>
        <div className="pcard-foot">
          <div className="pcard-vol">
            <svg viewBox="0 0 24 30" width="20" height="26" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><rect x="9" y="1.5" width="6" height="5" /><path d="M10.5 6.5v3M13.5 6.5v3" /><rect x="3" y="9.5" width="18" height="19" rx="2" /><rect x="8" y="15" width="8" height="6" /></svg>
            <span><b>{product.type}</b>{product.size}</span>
          </div>
          <span className="price">{formatPrice(product.price)}</span>
        </div>
        <button type="button" className={`btn pcard-add ${added ? 'added' : ''}`}
          onClick={() => { addToBag(product.id); setAdded(true); }}>
          {added ? <><Check size={15} /> Added</> : 'Add to Bag'}
        </button>
      </div>
    </article>
  );
}
