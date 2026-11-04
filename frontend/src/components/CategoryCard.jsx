import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SUITS = { heart: '♥', spade: '♠', diamond: '♦' };

function Rose() {
  return (
    <svg className="ace-rose" viewBox="0 0 100 130" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 38C8 28 14 8 38 6c24-2 40 8 42 26 2 18-14 30-30 28C34 58 24 50 22 38Z" />
      <path d="M30 36C24 26 30 14 46 13c14-1 24 8 22 20-2 12-14 18-24 14-8-3-13-8-14-11Z" />
      <path d="M38 34c-2-8 6-14 14-12 8 2 10 10 5 15-5 5-15 3-19-3Z" />
      <path d="M46 30c0-4 5-6 8-3 3 3 0 8-4 8" />
      <path d="M26 40C14 38 8 30 10 24M70 34c8 2 14 10 12 18" />
      <path d="M50 60C47 80 50 100 46 124" />
      <path d="M48 92C32 88 24 78 26 68c14 2 22 12 22 24Z" />
      <path d="M50 100c14-2 24-10 26-20-14 0-24 8-26 20Z" />
      <path d="M48 92c-6-6-12-12-18-20M50 100c8-6 16-13 22-19" strokeWidth="0.6" />
    </svg>
  );
}

// A playing-card tile: blush front with an ace index, burgundy back that turns into view on hover/focus.
// Optional bottle photo for the front: public/assets/collections/<photo>.png (hidden until the file exists).
export default function CategoryCard({ gender, title, notes, count, suit, index = 0 }) {
  const [hasPhoto, setHasPhoto] = useState(false);
  const glyph = SUITS[suit];
  const photo = `/assets/collections/for-${gender.toLowerCase()}.png`;
  // Only show the optional bottle photo if the file really exists and decodes as an image.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasPhoto(img.naturalWidth > 0);
    img.onerror = () => setHasPhoto(false);
    img.src = photo;
  }, [photo]);
  const Index = ({ flip }) => (
    <span className={`ace-index ${flip ? 'flip' : ''}`} aria-hidden="true"><b>A</b><i>{glyph}</i></span>
  );
  return (
    <Link to={`/collection?gender=${gender}`} className="cat-card" style={{ '--i': index }} aria-label={`${title}: ${count} fragrances`}>
      <span className="cat-flip">
        <span className={`ace-face ace-front ${hasPhoto ? 'has-photo' : ''}`}>
          <Index />
          <span className="ace-brand"><span>VELORA</span><small>Collection</small></span>
          {hasPhoto && <img className="ace-photo" src={photo} alt="" />}
          <span className="ace-text">
            <span className="ace-title">{title}</span>
            <span className="ace-notes">{notes}</span>
            <span className="ace-rule" />
            <span className="ace-sub">Eau de parfum<br />{count} fragrances</span>
          </span>
          <Index flip />
        </span>
        <span className="ace-face ace-back" aria-hidden="true">
          <Index />
          <Rose />
          <span className="ace-tag">Une élégance<br />qui reste.</span>
          <span className="ace-rule" />
          <span className="ace-cta">Discover {title}</span>
          <Index flip />
        </span>
      </span>
    </Link>
  );
}
