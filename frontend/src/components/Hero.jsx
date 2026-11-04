import { Link } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';

export default function Hero({
  imageSrc = '/assets/velora5.png',
}) {
  const isMobile = useMediaQuery('(max-width: 760px)');

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-media" aria-hidden="true">
        {!isMobile && (
          <img
            className="hero-img"
            src={imageSrc}
            alt=""
          />
        )}

        <div className="hero-veil" />
      </div>

      <div className="container hero-content">
        <p className="label rise" style={{ '--d': '.1s' }}>
          More than a fragrance
        </p>

        <h1
          id="hero-title"
          className="hero-word rise"
          style={{ '--d': '.25s' }}
          aria-label="VELORA"
        >
          <span aria-hidden="true">
            VEL
            <span className="hw-o">
              O
              <svg viewBox="0 0 24 24">
                <path d="M12 1c.7 6.2 4.8 10.3 11 11-6.2.7-10.3 4.8-11 11C11.3 16.8 7.2 12.7 1 12 7.2 11.3 11.3 7.2 12 1Z" />
              </svg>
            </span>
            RA
          </span>
        </h1>

        <p className="hero-tag rise" style={{ '--d': '.4s' }}>
          Scents for your story
        </p>

        <p className="lead rise" style={{ '--d': '.55s' }}>
          Discover a curated selection of iconic and niche perfumes from the
          world's most prestigious brands.
        </p>

        <div className="hero-cta rise" style={{ '--d': '.7s' }}>
          <Link to="/collection" className="btn">
            Shop Now
          </Link>

          <Link to="/#collections" className="btn btn-outline">
            Explore Collections
          </Link>
        </div>
      </div>
    </section>
  );
}