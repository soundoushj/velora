import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useShop } from '../context/ShopContext';

const LINKS = [
  { label: 'Home', to: '/', key: 'home' },
  { label: 'Collection', to: '/collection', key: 'all' },
  { label: 'For Her', to: '/collection?gender=Her', key: 'Her' },
  { label: 'For Him', to: '/collection?gender=Him', key: 'Him' },
  { label: 'Unisex', to: '/collection?gender=Unisex', key: 'Unisex' },
  { label: 'Our Story', to: '/our-story', key: 'story' },
];

export default function Navbar() {
  const { favorites, bagCount } = useShop();
  const { pathname, search } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const gender = new URLSearchParams(search).get('gender');
  const current = pathname === '/' ? 'home'
    : pathname === '/our-story' ? 'story'
    : pathname === '/collection' ? (['Her', 'Him', 'Unisex'].includes(gender) ? gender : 'all') : null;

  const solid = scrolled || pathname !== '/' || open;
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="nav-inner">
        <Link to="/" className="nav-logo" aria-label="VELORA — Home"><img src="/assets/velora-logo.png" alt="VELORA" width="64" height="64" /></Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.key} to={l.to} className={current === l.key ? 'active' : ''} aria-current={current === l.key ? 'page' : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="nav-actions">
          <Link to="/search" aria-label="Search"><Search size={20} /></Link>
          <Link to="/account" aria-label="Account"><User size={20} /></Link>
          <Link to="/favorites" className="nav-count-wrap" aria-label={`Favorites, ${favorites.length} saved`}>
            <Heart size={20} />{favorites.length > 0 && <span className="badge" key={favorites.length}>{favorites.length}</span>}
          </Link>
          <Link to="/bag" className="nav-count-wrap" aria-label={`Shopping bag, ${bagCount} items`}>
            <ShoppingBag size={20} />{bagCount > 0 && <span className="badge" key={bagCount}>{bagCount}</span>}
          </Link>
          <button type="button" className="nav-burger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="drawer" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <div id="drawer" className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <nav aria-label="Mobile">
          {LINKS.map((l) => (
            <Link key={l.key} to={l.to} tabIndex={open ? 0 : -1} className={current === l.key ? 'active' : ''}>{l.label}</Link>
          ))}
          <Link to="/search" tabIndex={open ? 0 : -1}>Search</Link>
          <Link to="/account" tabIndex={open ? 0 : -1}>Account</Link>
        </nav>
      </div>
    </header>
  );
}
