import { Link } from 'react-router-dom';
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" aria-label="VELORA — Home"><img src="/assets/velora-logo.png" alt="VELORA" width="84" height="84" /></Link>
          <p>A contemporary perfume house celebrating the art of fragrance, elegance and individuality.</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="label">Shop</h2>
          <Link to="/collection">All Fragrances</Link>
          <Link to="/collection?gender=Her">For Her</Link>
          <Link to="/collection?gender=Him">For Him</Link>
          <Link to="/collection?gender=Unisex">Unisex</Link>
          <Link to="/collection?best=1">Bestsellers</Link>
        </nav>
        <nav aria-label="Customer service">
          <h2 className="label">Customer Service</h2>
          <Link to="/info/delivery">Delivery</Link>
          <Link to="/info/returns">Returns</Link>
          <Link to="/info/contact">Contact</Link>
          <Link to="/info/faq">FAQ</Link>
          <Link to="/our-story">Our Story</Link>
        </nav>
        <div>
          <h2 className="label">Newsletter</h2>
          <p>News, new notes and gentle reminders.</p>
          <Link to="/#newsletter" className="underline-link">Join the letter</Link>
        </div>
      </div>
      <p className="footer-bottom">© 2026 VELORA. A fictional concept brand created for a university project.</p>
    </footer>
  );
}
