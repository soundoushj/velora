import DataGate from '../components/DataGate';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../data/products';

const FIELDS = [
  ['name', 'Full name', 'text', 'name'],
  ['phone', 'Phone number', 'tel', 'tel'],
  ['city', 'City', 'text', 'address-level2'],
  ['address', 'Delivery address', 'text', 'street-address'],
];

function CheckoutDemoInner() {
  const { bagItems, subtotal, deliveryCost, total, clearBag } = useShop();
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);

  if (done) {
    return (
      <div className="container narrow page-pad center">
        <div className="empty">
          <p className="label">Demo confirmation</p>
          <h1>Thank you, {done.name.split(' ')[0]}.</h1>
          <p>This was a demonstration. No order was placed, no payment was taken and nothing was sent. Your total would have been {formatPrice(done.total)}.</p>
          <Link to="/collection" className="btn">Continue Exploring</Link>
        </div>
      </div>
    );
  }
  if (bagItems.length === 0) return <Navigate to="/bag" replace />;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    FIELDS.forEach(([k, label]) => { if (!form[k].trim()) errs[k] = `${label} is required.`; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setDone({ name: form.name.trim(), total });
    clearBag();
  };

  return (
    <div className="container page-pad">
      <header className="section-head center"><p className="label">Demo Checkout</p><h1>Review your order</h1>
        <p className="lead">A frontend concept only. We never ask for payment details.</p></header>
      <div className="bag">
        <form className="co-form" onSubmit={submit} noValidate>
          <h2>Delivery details</h2>
          {FIELDS.map(([k, label, type, ac]) => (
            <div className="field" key={k}>
              <label htmlFor={`f-${k}`}>{label}</label>
              <input id={`f-${k}`} type={type} autoComplete={ac} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `e-${k}` : undefined} />
              {errors[k] && <p id={`e-${k}`} className="field-err" role="alert">{errors[k]}</p>}
            </div>
          ))}
          <p className="fine">Payment: cash on delivery (demo). No card details are collected.</p>
          <button type="submit" className="btn btn-block">Confirm Demo Order</button>
          <Link to="/bag" className="btn btn-outline btn-block">Back to Bag</Link>
        </form>
        <aside className="summary" aria-label="Order summary">
          <h2>Your selection</h2>
          <ul className="mini">
            {bagItems.map(({ id, qty, product }) => (
              <li key={id}><span>{product.name} × {qty}</span><span>{formatPrice(product.price * qty)}</span></li>
            ))}
          </ul>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd>{deliveryCost === 0 ? 'Free' : formatPrice(deliveryCost)}</dd></div>
            <div className="total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutDemo() {
  return <DataGate><CheckoutDemoInner /></DataGate>;
}
