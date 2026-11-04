import DataGate from '../components/DataGate';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import ProductImage from '../components/ProductImage';
import QuantitySelector from '../components/QuantitySelector';
import EmptyState from '../components/EmptyState';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, useShop } from '../context/ShopContext';
import { formatPrice } from '../data/products';

function ShoppingBagInner() {
  const { bagItems, increaseQty, decreaseQty, removeFromBag, clearBag, subtotal, deliveryCost, total } = useShop();
  const navigate = useNavigate();
  return (
    <div className="container page-pad">
      <header className="section-head center"><p className="label">Shopping Bag</p><h1>Your Bag</h1></header>
      {bagItems.length === 0 ? (
        <EmptyState title="A little room for something beautiful." text="Your bag is waiting for a fragrance that feels like you." cta="Discover the Collection" />
      ) : (
        <div className="bag">
          <ul className="bag-list">
            {bagItems.map(({ id, qty, product }) => (
              <li key={id} className="bag-row">
                <Link to={`/product/${id}`} className="bag-img"><ProductImage product={product} compact /></Link>
                <div className="bag-info">
                  <p className="label">{product.brand} · {product.family} · {product.gender}</p>
                  <h2><Link to={`/product/${id}`}>{product.name}</Link></h2>
                  <p className="muted">{formatPrice(product.price)} · {product.size}</p>
                  <button type="button" className="text-btn" onClick={() => removeFromBag(id)}><Trash2 size={14} /> Remove</button>
                </div>
                <QuantitySelector value={qty} label={`Quantity of ${product.name}`} onDecrease={() => decreaseQty(id)} onIncrease={() => increaseQty(id)} />
                <p className="bag-line price">{formatPrice(product.price * qty)}</p>
              </li>
            ))}
          </ul>
          <aside className="summary" aria-label="Order summary">
            <h2>Order Summary</h2>
            <dl>
              <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
              <div><dt>Delivery</dt><dd>{deliveryCost === 0 ? 'Free' : formatPrice(deliveryCost)}</dd></div>
              <div className="total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
            </dl>
            <p className="fine">{deliveryCost === 0
              ? `Free delivery applied (orders over ${formatPrice(FREE_DELIVERY_THRESHOLD)}).`
              : `Add ${formatPrice(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery. Otherwise a flat ${formatPrice(DELIVERY_FEE)} applies.`} Demo policy.</p>
            <button type="button" className="btn btn-block" onClick={() => navigate('/checkout')}>Checkout</button>
            <Link to="/collection" className="btn btn-outline btn-block">Continue Shopping</Link>
            <button type="button" className="text-btn center-btn" onClick={clearBag}>Clear Bag</button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function ShoppingBag() {
  return <DataGate><ShoppingBagInner /></DataGate>;
}
