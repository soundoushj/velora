import { useCallback, useEffect, useRef, useState } from 'react';
import Reveal from './Reveal';
import '../styles/craft.css';

/*
  The Craft — pinned, scroll-driven 3D storytelling.
  Falls back to the original static three-row layout when the visitor prefers reduced
  motion, or WebGL isn't available.
*/

const STAGE_AT = [0.14, 0.53, 0.9]; // scroll progress that best represents each stage (used by step buttons)

function canRun3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function StaticCraft({ steps }) {
  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-head center"><p className="label">The Craft</p><h2 className="sec-title">The Craft of <em>Fragrance</em></h2></Reveal>
        <div className="craft">
          {steps.map(([n, t, d], i) => (
            <Reveal key={n} className={`craft-row ${i % 2 ? 'flip' : ''}`}>
              <div className="craft-img" aria-hidden="true"><span>{n}</span></div>
              <div><p className="num">{n}</p><h3>{t}</h3><p className="lead">{d}</p></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CraftExperience({ steps }) {
  const [mode, setMode] = useState(() => (canRun3D() ? 'pin' : 'static'));
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const visualRef = useRef(null);
  const canvasRef = useRef(null);

  // honour a live change of the reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setMode(mq.matches || !canRun3D() ? 'static' : 'pin');
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (mode !== 'pin') return undefined;
    let api; let cancelled = false;
    const lite = window.matchMedia('(max-width: 860px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    import('../three/craftScene').then(({ createCraftScene }) => {
      if (cancelled || !canvasRef.current) return;
      api = createCraftScene({
        canvas: canvasRef.current,
        track: trackRef.current,
        stage: stageRef.current,
        visual: visualRef.current,
        lite,
        onStep: setStep,
        onReady: () => setReady(true),
        onError: () => setMode('static'),
      });
    }).catch(() => setMode('static'));
    return () => { cancelled = true; api?.dispose(); };
  }, [mode]);

  const goTo = useCallback((i) => {
    const track = trackRef.current; const stage = stageRef.current;
    if (!track || !stage) return;
    const travel = track.offsetHeight - stage.offsetHeight;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + travel * STAGE_AT[i], behavior: 'smooth' });
  }, []);

  if (mode === 'static') return <StaticCraft steps={steps} />;

  return (
    <section className="craft3d" data-step={step} data-ready={ready ? 'true' : 'false'} aria-labelledby="craft-title">
      <div className="craft3d-track" ref={trackRef}>
        <div className="craft3d-stage" ref={stageRef}>
          <div className="container craft3d-grid">
            <div className="craft3d-copy">
              <p className="label">The Craft</p>
              <h2 className="sec-title" id="craft-title">The Craft of <em>Fragrance</em></h2>

              <ol className="craft3d-steps">
                {steps.map(([n, t, d], i) => (
                  <li key={n} className={`craft3d-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} aria-current={i === step ? 'step' : undefined} data-i={i}>
                    <span className="craft3d-node" aria-hidden="true" />
                    <span className="craft3d-seg" aria-hidden="true" />
                    <h3 className="craft3d-h">
                      <button type="button" className="craft3d-head" onClick={() => goTo(i)}>
                        <span className="num">{n}</span>
                        <span className="craft3d-title">{t}</span>
                      </button>
                    </h3>
                    <div className="craft3d-desc"><div><p className="lead">{d}</p></div></div>
                  </li>
                ))}
              </ol>

              <div className="craft3d-dots" aria-hidden="true">
                {steps.map(([n], i) => <span key={n} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
              </div>
              <p className="craft3d-cue" aria-hidden="true"><span />Scroll</p>
            </div>

            <div className="craft3d-visual" ref={visualRef} aria-hidden="true">
              <div className="craft3d-arch" />
              <canvas ref={canvasRef} className="craft3d-canvas" />
              <ul className="craft3d-legend">
                <li><i className="k-top" />Top</li>
                <li><i className="k-heart" />Heart</li>
                <li><i className="k-base" />Base</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
