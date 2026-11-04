import ProductCard from './ProductCard';
export default function ProductGrid({ items, badge, cols = 4 }) {
  return (
    <div className={`pgrid cols-${cols}`}>
      {items.map((p, i) => <ProductCard key={p.id} product={p} badge={badge} index={i} />)}
    </div>
  );
}
