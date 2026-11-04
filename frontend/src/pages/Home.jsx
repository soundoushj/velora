import { Link } from 'react-router-dom';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import Newsletter from '../components/Newsletter';
import Reveal from '../components/Reveal';
import CategoryCard from '../components/CategoryCard';
import DataGate from '../components/DataGate';
import { useShop } from '../context/ShopContext';
const CATEGORIES = [
  { gender: 'Her', title: 'For Her', notes: 'Rose · Peony · Musk', suit: 'heart' },
  { gender: 'Him', title: 'For Him', notes: 'Oud · Cedar · Amber', suit: 'spade' },
  { gender: 'Unisex', title: 'Unisex', notes: 'Amber · Citrus · Musk', suit: 'diamond' },
];

export default function Home() {
  const { products, getProduct, loading } = useShop();
  const pick = (ids) => ids.map(getProduct).filter(Boolean);
  return (
    <>
      <Hero />

      <section className="section-tight-top" id="collections" aria-labelledby="cat-title">
        <div className="container">
          <Reveal className="section-head center">
            <p className="label">Collections</p>
            <h2 id="cat-title" className="sec-title">Shop by <em>Collection</em></h2>
          </Reveal>
          <Reveal className="cat-grid">
            {CATEGORIES.map((c, i) => (
              <CategoryCard key={c.gender} {...c} index={i}
                count={loading ? '' : products.filter((p) => p.gender === c.gender).length} />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section" id="signature" aria-labelledby="sig-title">
        <div className="container">
          <Reveal className="section-head center">
            <p className="label">The Collection</p>
            <h2 id="sig-title" className="sec-title">Find Your <em>Signature</em></h2>
            <p className="lead">A fragrance for every side of you.</p>
          </Reveal>
          <DataGate compact><Reveal><ProductGrid items={pick(['dg-the-one', 'lancome-la-nuit-tresor', 'dior-sauvage', 'ysl-libre'])} /></Reveal></DataGate>
          <div className="center mt"><Link to="/collection" className="btn btn-outline">View All Fragrances</Link></div>
        </div>
      </section>

      <section className="section-band" aria-labelledby="phil-title">
        <div className="container split phil">
          <Reveal className="split-media tall">
            <img src="/assets/philo_section.jpg" alt="A burgundy perfume bottle wrapped in satin ribbon on blush satin" className="crop-bottle" loading="lazy" />
          </Reveal>
          <Reveal className="split-text frame">
            <p className="label light">Our Philosophy</p>
            <h2 id="phil-title">Beauty in <em>every note.</em></h2>
            <p className="lead">At VELORA, fragrance is more than a finishing touch. It is a personal ritual, a memory waiting to happen, and a quiet expression of who you are. We believe the most beautiful scents do not demand attention. They earn it.</p>
            <Link to="/our-story" className="btn btn-light">Discover Our Philosophy</Link>
          </Reveal>
        </div>
      </section>

      <section className="section sand" aria-labelledby="best-title">
        <div className="container">
          <Reveal className="section-head center">
            <p className="label">Bestsellers</p>
            <h2 id="best-title" className="sec-title">The Ones You <em>Remember</em></h2>
            <p className="lead">Discover the fragrances our community loves most.</p>
          </Reveal>
          <DataGate compact><Reveal><ProductGrid cols={3} badge="Bestseller" items={pick(['jpg-scandal', 'chanel-bleu-de-chanel', 'viktor-rolf-spicebomb-extreme'])} /></Reveal></DataGate>
          <div className="center mt"><Link to="/collection?best=1" className="btn btn-outline">Shop All Bestsellers</Link></div>
          <p className="fine center">Bestseller labels and ratings are fictional sample content.</p>
        </div>
      </section>
      <Newsletter />
    </>
  );
}
