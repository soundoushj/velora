import DataGate from '../components/DataGate';
import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../data/products';
import { request } from '../services/api';

const FIELDS = [
  ['name', 'Full name', 'text', 'name'],
  ['phone', 'Phone number', 'tel', 'tel'],
  ['city', 'City', 'text', 'address-level2'],
  ['address', 'Delivery address', 'text', 'street-address'],
];
// The API names the name field "fullName"; the form calls it "name".
const API_TO_FORM = { fullName: 'name', phone: 'phone', city: 'city', address: 'address' };

// Same phone rules as the server (Algerian mobile / landline, or an international +number).
const normalizePhone = (raw) => {
  let p = raw.replace(/[\s().-]/g, '');
  if (p.startsWith('00213')) p = `+213${p.slice(5)}`;
  if (p.startsWith('+213')) p = `0${p.slice(4)}`;
  return p;
};
const phoneOk = (raw) => {
  const p = normalizePhone(raw);
  return /^0(?:[567]\d{8}|[234]\d{7})$/.test(p) || /^\+[1-9]\d{7,14}$/.test(p);
};

// One random key per checkout attempt: if the same request is sent twice (double click, retry after a
// network timeout) the server recognises it and never creates a second order.
const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

function CheckoutDemoInner() {
  const { bagItems, subtotal, deliveryCost, total, clearBag } = useShop();
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const keyRef = useRef(newKey());
  const lockRef = useRef(false); // set synchronously, so two quick clicks can never both pass

  if (done) {
    return (
      <div className="container narrow page-pad center">
        <div className="empty" role="status">
          <p className="label">Order received</p>
          <h1>Thank you, {done.customer.fullName.split(' ')[0]}.</h1>
          <p>Your order number is <strong>{done.orderNumber}</strong>. Please keep it for any question about your delivery.</p>
          <p>Total to pay on delivery: <strong>{formatPrice(done.total)}</strong>
            {done.deliveryFee === 0 ? ' (free delivery included)' : ` (including ${formatPrice(done.deliveryFee)} delivery)`}. We will contact you by phone to confirm your order.</p>
          <Link to="/collection" className="btn">Continue Exploring</Link>
        </div>
      </div>
    );
  }
  if (bagItems.length === 0) return <Navigate to="/bag" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (lockRef.current) return;
    const errs = {};
    FIELDS.forEach(([k, label]) => { if (!form[k].trim()) errs[k] = `${label} is required.`; });
    if (!errs.phone && !phoneOk(form.phone.trim())) errs.phone = 'Enter a valid phone number, for example 0550 12 34 56.';
    setErrors(errs);
    setSubmitError('');
    if (Object.keys(errs).length) return;

    lockRef.current = true;
    setSubmitting(true);
    try {
      // Only identification + quantity are sent. The server looks up the real prices and computes the total.
      const res = await request('/orders', {
        method: 'POST',
        body: {
          customer: { fullName: form.name.trim(), phone: form.phone.trim(), city: form.city.trim(), address: form.address.trim() },
          items: bagItems.map(({ id, qty }) => ({ productId: id, quantity: qty })),
          idempotencyKey: keyRef.current,
        },
      });
      setDone(res.data);
      clearBag(); // only now that the server confirmed the order
    } catch (err) {
      const fieldErrors = {};
      (err.errors || []).forEach((x) => {
        const k = API_TO_FORM[String(x.field || '').replace('customer.', '')];
        if (k && !fieldErrors[k]) fieldErrors[k] = x.message;
      });
      setErrors(fieldErrors);
      setSubmitError(Object.keys(fieldErrors).length
        ? 'Please check the highlighted fields.'
        : `${err.message}${err.status === 409 ? ' Your bag has been kept: you can adjust it and try again.' : ' Your bag is still saved.'}`);
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-pad">
      <header className="section-head center"><p className="label">Checkout</p><h1>Review your order</h1>
        <p className="lead">We never ask for payment details. You pay in cash when your order arrives.</p></header>
      <div className="bag">
        <form className="co-form" onSubmit={submit} noValidate aria-busy={submitting}>
          <h2>Delivery details</h2>
          {FIELDS.map(([k, label, type, ac]) => (
            <div className="field" key={k}>
              <label htmlFor={`f-${k}`}>{label}</label>
              <input id={`f-${k}`} type={type} autoComplete={ac} value={form[k]} disabled={submitting} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `e-${k}` : undefined} />
              {errors[k] && <p id={`e-${k}`} className="field-err" role="alert">{errors[k]}</p>}
            </div>
          ))}
          <p className="fine">Payment: cash on delivery. No card details are collected.</p>
          {submitError && <p className="field-err" role="alert">{submitError}</p>}
          <button type="submit" className="btn btn-block" disabled={submitting}>{submitting ? 'Placing your order…' : 'Confirm Order'}</button>
          <Link to="/bag" className="btn btn-outline btn-block" aria-disabled={submitting} onClick={(e) => { if (submitting) e.preventDefault(); }}>Back to Bag</Link>
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
