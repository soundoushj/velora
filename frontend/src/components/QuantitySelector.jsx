import { Minus, Plus } from 'lucide-react';
export default function QuantitySelector({ value, onDecrease, onIncrease, label = 'Quantity', min = 1 }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={onDecrease} disabled={value <= min} aria-label="Decrease quantity"><Minus size={15} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={onIncrease} aria-label="Increase quantity"><Plus size={15} /></button>
    </div>
  );
}
