import { useEffect, useState } from 'react';

// Shows the real product photo (public/assets/perfumes/<id>.jpg). If the file is missing,
// a clearly labelled placeholder is shown instead, naming the exact file to provide.
export default function ProductImage({ product, compact = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.id]);
  if (!failed) {
    return <img className={`pimg ${className}`} src={product.image} alt={`${product.name} perfume bottle`} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <div className={`pimg pimg-ph ${compact ? 'compact' : ''} ${className}`} role="img" aria-label={`Placeholder: photo of ${product.name} to be provided`}>
      <span className="ph-mark">V</span>
      {!compact && (
        <>
          <span className="ph-name">{product.name}</span>
          <span className="ph-file">Photo to provide<br /><code>perfumes/{product.id}.jpg</code></span>
        </>
      )}
    </div>
  );
}
