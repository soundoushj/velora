import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import CraftExperience from '../components/CraftExperience';

const CRAFT = [
  ['01', 'Choosing the Notes', 'We begin with a feeling, a memory or a moment, then explore the notes that can bring it to life.'],
  ['02', 'Composing the Accord', 'Top, heart and base notes are balanced to create a fragrance that unfolds naturally from its first impression to its lasting trail.'],
  ['03', 'Letting It Rest', 'Each composition is refined with care until its character feels harmonious, expressive and complete.'],
];
const VALUES = [
  ['Authenticity', 'Every fragrance begins with an honest idea. We describe each scent with clarity and care.'],
  ['Individuality', 'A fragrance evolves with the person wearing it. We celebrate personal expression rather than prescribe it.'],
  ['Timeless Elegance', 'We prefer balance to excess. A beautiful scent should feel as meaningful years from now as it does today.'],
];

export default function OurStory() {
  return (
    <>
      <section className="story-hero">
        <div className="container split">
          <div className="split-text rise">
            <p className="label">Our Story</p>
            <h1>Every scent tells a story.</h1>
            <p className="lead">VELORA began with a simple idea: perfume should feel personal, not performative. We imagine a house where each fragrance is composed with intention, described honestly and worn with ease, by anyone, in any season.</p>
          </div>
          <div className="split-media tall rise" style={{ '--d': '.2s' }}>
            <img src="/assets/our_story.png" alt="Burgundy perfume bottle wrapped in satin ribbon" className="crop-bottle" />
          </div>
        </div>
      </section>

      <section className="section blush">
        <div className="container split reverse">
          <Reveal className="split-media sq"><div className="logo-panel"><img src="/assets/velora_calculs.png" alt="VELORA monogram" /></div></Reveal>
          <Reveal className="split-text frame">
            <p className="label light">Our Philosophy</p>
            <h2>Our <em>philosophy</em></h2>
            <p className="lead">We believe a fragrance is a quiet form of expression. It is the first impression that lingers and the memory that remains. We keep our collection considered and intentional, so each scent has room to be distinct.</p>
          </Reveal>
        </div>
      </section>

      <CraftExperience steps={CRAFT} />

      <section className="section dark">
        <div className="container">
          <Reveal className="section-head center"><p className="label light">What We Value</p><h2 className="sec-title">What we <em>value</em></h2></Reveal>
          <Reveal className="values">
            {VALUES.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </Reveal>
        </div>
      </section>

      <section className="section cta-final">
        <Reveal className="container narrow center">
          <h2 className="sec-title">Find the scent that <em>feels like you.</em></h2>
          <Link to="/collection" className="btn">Explore the Collection</Link>
        </Reveal>
      </section>
    </>
  );
}
