import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/*
  VELORA — "The Craft" scene
  ------------------------------------------------------------------
  One continuous, scroll-scrubbed composition built around the supplied crystal bottle.

    Stage 01  Choosing the Notes   — pearls (top), petals (heart) and amber resin (base)
                                      surface one by one and drift loosely around the bottle.
    Stage 02  Composing the Accord — the three families fall into tilted orbits of different
                                      radius and speed; fine gold hairlines trace each orbit.
    Stage 03  Letting It Rest      — orbits slow to a stop and the notes settle into three
                                      calm strata (top / heart / base) around the bottle.

  Everything is a pure function of smoothed scroll progress `p` (0..1) so scrubbing in
  either direction is continuous. The only "free-running" state is orbit phase, which is
  integrated with a speed that is eased to zero before the settle begins, so nothing jumps.
*/

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const wrapPi = (x) => ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// Seeded RNG so the composition is identical on every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- procedural assets ---------- */

function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 6, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const v = y + 0.5;                                    // 0 base → 1 tip
    const width = 0.78 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.85);
    const nx = x * width * 1.1;
    const cup = 1.6 * nx * nx;                              // cross-wise curl
    const bend = 0.28 * v * v - 0.06 * v;                  // length-wise arc
    pos.setXYZ(i, nx, y, cup + bend);
  }
  g.computeVertexNormals();
  return g;
}

function resinGeometry(rand) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [1 + (rand() - 0.5) * 0.45, 1 + (rand() - 0.5) * 0.45, 1 + (rand() - 0.5) * 0.45]);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k[0], pos.getY(i) * k[1] * 0.78, pos.getZ(i) * k[2]);
  }
  g.computeVertexNormals();
  return g;
}

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  ctx.fillStyle = grd; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A small studio of coloured softboxes, baked to an environment map: gives the crystal
// warm ivory highlights with rose + gold edges rather than flat grey reflections.
function buildEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), new THREE.MeshBasicMaterial({ color: 0x4a1a2a, side: THREE.BackSide })));
  const panel = (w, h, hex, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(6, 3.6, '#fff3e6', 7, [-4.5, 4, 4]);      // key — warm ivory
  panel(2.2, 7, '#ffc9d6', 5, [6, 0.5, -1]);        // rose rim, right
  panel(7, 1.6, '#f6d9a0', 4.5, [0, 5.2, -3]);      // gold strip above/behind
  panel(3.5, 3.5, '#b83a62', 2.4, [3.5, -3, 5]);    // wine fill, low
  panel(2, 6, '#fff7f0', 3.5, [-6.5, 0, -2]);       // cool-white edge, left
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt;
}

/* ---------- main ---------- */

export function createCraftScene({ canvas, track, stage, visual, lite = false, onStep, onReady, onError }) {
  let disposed = false;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { onError?.(err); return { dispose() {} }; }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;

  const FOV = 30, BASE_D = 6.2;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);

  const world = new THREE.Group();          // uniformly scaled to fit the visual box
  scene.add(world);

  /* --- bottle --- */
  const bottle = new THREE.Group();         // yaw / pitch pivot at the bottle's centre
  world.add(bottle);
  let liquidMat = null;
  let bottleHalf = 0.6;
  const BOTTLE_H = 1.42;

  /* --- note families --- */
  const rand = rng(7);
  const N = lite ? { top: 14, heart: 12, base: 9 } : { top: 26, heart: 22, base: 16 };

  const FAM = {
    top: {
      n: N.top, speed: 0.34,
      scatter: { r: [0.85, 1.5], y: [0.3, 1.45] }, orbit: { r: 1.38, y: 0.62, jr: 0.12, jy: 0.1 }, rest: { r: 0.98, y: 1.02 },
      tilt: [0.5, -0.3], size: [0.022, 0.044],
    },
    heart: {
      n: N.heart, speed: -0.25,
      scatter: { r: [0.8, 1.5], y: [-0.55, 0.95] }, orbit: { r: 1.12, y: 0.0, jr: 0.09, jy: 0.1 }, rest: { r: 1.14, y: -0.02 },
      tilt: [-0.42, 0.4], size: [0.13, 0.2],
    },
    base: {
      n: N.base, speed: 0.19,
      scatter: { r: [0.7, 1.45], y: [-1.3, -0.3] }, orbit: { r: 0.92, y: -0.52, jr: 0.08, jy: 0.08 }, rest: { r: 0.9, y: -0.64 },
      tilt: [0.22, 0.26], size: [0.04, 0.07],
    },
  };

  const geoPearl = new THREE.SphereGeometry(1, 20, 14);
  const geoPetal = petalGeometry();
  const geoResin = resinGeometry(rng(21));
  const matPearl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.28, roughness: 0.26, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color('#fff1d6'), emissive: new THREE.Color('#e9cf9a'), emissiveIntensity: 0.22, envMapIntensity: 1.3 });
  const matPetal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#ffd3df'), sheenRoughness: 0.35, clearcoat: 0.25, envMapIntensity: 1.1 });
  const matResin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.14, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true, emissive: new THREE.Color('#a85a1c'), emissiveIntensity: 0.2, envMapIntensity: 1.5 });

  const colour = (hex) => new THREE.Color(hex);
  const palette = {
    top: [colour('#fbf1dc'), colour('#ecd4a0')],
    heart: [colour('#f7bccb'), colour('#d93a74')],
    base: [colour('#f0a95a'), colour('#c97a34')],
  };

  const families = {};
  const tmpC = new THREE.Color();
  for (const key of Object.keys(FAM)) {
    const f = FAM[key];
    const geo = key === 'top' ? geoPearl : key === 'heart' ? geoPetal : geoResin;
    const mat = key === 'top' ? matPearl : key === 'heart' ? matPetal : matResin;
    const mesh = new THREE.InstancedMesh(geo, mat, f.n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);

    // orbit hairline
    const pts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * TAU; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc9a46a, transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    group.add(line);
    world.add(group);

    const items = [];
    for (let i = 0; i < f.n; i++) {
      const u = i / f.n;
      const it = {
        spd: (0.8 + rand() * 0.45),
        phase: rand() * TAU,
        restA: u * TAU + (rand() - 0.5) * 0.08,
        r1: lerp(f.scatter.r[0], f.scatter.r[1], rand()),
        y1: lerp(f.scatter.y[0], f.scatter.y[1], rand()),
        r2: f.orbit.r + (rand() - 0.5) * 2 * f.orbit.jr,
        y2: f.orbit.y + (rand() - 0.5) * 2 * f.orbit.jy,
        r3: f.rest.r + (i % 2 ? 0.035 : -0.035),
        y3: f.rest.y,
        size: lerp(f.size[0], f.size[1], rand()),
        stagger: rand() * 0.55,
        bob: rand() * TAU,
        e0: [rand() * TAU, rand() * TAU, rand() * TAU],
        es: [(rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8],
        angle: 0, rot: 0,
      };
      it.angle = rand() * TAU;                // orbit phase (integrated)
      items.push(it);
      tmpC.copy(palette[key][0]).lerp(palette[key][1], rand());
      mesh.setColorAt(i, tmpC);
    }
    mesh.instanceColor.needsUpdate = true;
    families[key] = { f, mesh, group, line, lineMat, items, key };
  }

  /* --- soft contact shadow + bokeh --- */
  const shadowTex = radialTexture([[0, 'rgba(10,0,6,0.65)'], [0.55, 'rgba(10,0,6,0.22)'], [1, 'rgba(10,0,6,0)']]);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  world.add(shadow);

  const bokehTex = radialTexture([[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  const bokeh = [];
  const bokehCols = ['#e8c987', '#f4a3bb', '#e8c987', '#f9d5de', '#d66a8e', '#e8c987'];
  const nBokeh = lite ? 3 : 6;
  for (let i = 0; i < nBokeh; i++) {
    const m = new THREE.SpriteMaterial({ map: bokehTex, color: bokehCols[i], transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending });
    const sp = new THREE.Sprite(m);
    const sc = 0.42 + rand() * 0.42;
    sp.scale.set(sc, sc, 1);
    sp.userData = { x: (rand() - 0.5) * 3.4, y: (rand() - 0.5) * 2.6, z: 1.7 + rand() * 1.4, ph: rand() * TAU, a: 0.1 + rand() * 0.1 };
    world.add(sp); bokeh.push(sp);
  }

  /* --- load the supplied bottle --- */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let bottleReady = false;
  loader.loadAsync('/models/velora-bottle.glb').then((gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = BOTTLE_H / size.y;
    const holder = new THREE.Group();
    model.position.sub(center);
    holder.add(model);
    holder.scale.setScalar(k);
    bottle.add(holder);
    bottleHalf = BOTTLE_H / 2;

    model.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.name === 'Material_317') { o.visible = false; return; }       // fully transparent (alpha 0) helper shell
      if (m.transmission) m.transmission = 0;                              // transmission pass is costly and reads flat over a transparent canvas
      m.envMapIntensity = 1.6;
      if (m.transparent) { m.depthWrite = false; o.renderOrder = 2; }
      if (m.name === 'Material_306') { liquidMat = m; m.color.set('#f2a9c0'); m.emissive = new THREE.Color('#d1355f'); m.emissiveIntensity = 0.0; }
      if (m.name === 'Material_318' || m.name === 'Material_305') { m.color.set('#ffe9ef'); m.opacity = 0.34; }
    });
    bottleReady = true;
    onReady?.();
  }).catch((err) => { if (!disposed) onError?.(err); });

  /* --- layout --- */
  let W = 1, H = 1, S = 1;
  function resize() {
    const r = visual.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.8);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    // fit: widest ring (≈ ±1.4 + petal) and the full vertical spread must stay inside the box
    const pxPerUnit = H / (2 * BASE_D * Math.tan((FOV * Math.PI) / 360));
    const needW = 3.35, needH = 3.4;
    S = clamp(Math.min(W / (needW * pxPerUnit), H / (needH * pxPerUnit)), 0.5, 1.15);
    world.scale.setScalar(S);
    world.position.y = -0.1 * S;       // optical centring: the settled strata sit slightly above the bottle's centre
  }
  const ro = new ResizeObserver(resize);
  ro.observe(visual);
  resize();

  /* --- pointer parallax (fine pointers only) --- */
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    const r = stage.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  if (fine) stage.addEventListener('pointermove', onPointer, { passive: true });

  /* --- scroll progress --- */
  let pTarget = 0, pCur = 0, eTarget = 0, eCur = 0, first = true;
  function readScroll() {
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = Math.max(1, r.height - stage.offsetHeight);
    pTarget = clamp(-r.top / travel);
    eTarget = clamp(1 - r.top / (vh * 0.9));
  }

  /* --- frame --- */
  const q = new THREE.Quaternion(), qFree = new THREE.Quaternion(), qRest = new THREE.Quaternion();
  const eul = new THREE.Euler(), mat4 = new THREE.Matrix4(), basis = new THREE.Matrix4();
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let time = 0, lastStep = -1, running = false, raf = 0, last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; time += dt;

    readScroll();
    if (first) { pCur = pTarget; eCur = eTarget; first = false; }
    const k = 1 - Math.exp(-dt * 4.2);
    pCur += (pTarget - pCur) * k;
    eCur += (eTarget - eCur) * (1 - Math.exp(-dt * 6));
    const p = pCur, e = smooth(0, 1, eCur);

    // stage value: 0 → 1 → 2, with calm plateaus in between
    const s = smooth(0.26, 0.46, p) + smooth(0.6, 0.8, p);
    const w2 = clamp(s) - clamp(s - 1), w3 = clamp(s - 1), w1 = 1 - clamp(s);
    const step = s < 0.5 ? 0 : s < 1.5 ? 1 : 2;
    if (step !== lastStep) { lastStep = step; onStep?.(step); }

    // CSS hooks (set on the stage so only the stage subtree restyles)
    const st = stage.style;
    st.setProperty('--p', p.toFixed(4));
    st.setProperty('--e', e.toFixed(4));
    st.setProperty('--f0', clamp(s).toFixed(4));
    st.setProperty('--f1', clamp(s - 1).toFixed(4));
    st.setProperty('--w3', w3.toFixed(4));

    // pointer easing
    mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3));
    mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));

    // camera: slow dolly + arc, easing to a still frame at the end
    const ep = smoother(0, 1, p);
    const az = lerp(-0.34, 0.16, ep) + mouse.x * 0.09 + Math.sin(time * 0.17) * 0.012;
    const el = lerp(0.24, 0.085, ep) - mouse.y * 0.04;
    const dist = BASE_D + lerp(0.7, -0.35, smooth(0, 0.55, p)) + lerp(0, 0.6, smooth(0.62, 1, p));
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(0, 0.02, 0);

    // bottle: eased yaw across the whole journey, so it decelerates into a still final pose
    const yaw = lerp(-1.75, 0.07, ep) + Math.sin(time * 0.35) * 0.025 * (1 - w3 * 0.6);
    const pitch = lerp(0.16, 0.05, ep);
    bottle.rotation.set(pitch, yaw, 0.0);
    const scaleIn = lerp(0.82, 1, smooth(0, 0.3, p)) * lerp(0.9, 1, e);
    bottle.scale.setScalar(scaleIn);
    bottle.position.y = Math.sin(time * 0.6) * 0.018 * (1 - w3 * 0.7) + lerp(-0.12, 0, e);
    if (liquidMat) liquidMat.emissiveIntensity = 0.04 + w3 * 0.2 + w2 * 0.06;

    // shadow
    shadow.position.y = -bottleHalf * scaleIn - 0.04;
    shadow.material.opacity = e * (0.25 + 0.65 * w3);
    shadow.scale.setScalar(lerp(0.8, 1.05, smooth(0, 1, p)));

    // bokeh depth cues
    for (const sp of bokeh) {
      const d = sp.userData;
      sp.position.set(d.x + Math.sin(time * 0.12 + d.ph) * 0.18, d.y + Math.cos(time * 0.1 + d.ph) * 0.14, d.z);
      sp.material.opacity = d.a * e * (0.55 + 0.45 * w2) * (1 - 0.5 * w3);
    }

    // families
    const spdMul = lerp(0.3, 1, w2) * (1 - smooth(0, 0.45, w3));      // orbit speed: slow drift → full → stop
    const sm = smooth(0.5, 1, w3);                                      // settle blend — starts only once orbit speed has reached zero
    const intro = smooth(0.0, 0.24, p);

    for (const key of Object.keys(families)) {
      const fam = families[key];
      const f = fam.f;
      // tilted orbital planes only exist in stage 02
      fam.group.rotation.set(f.tilt[0] * w2, 0, f.tilt[1] * w2);

      // hairline
      const lr = w1 * f.orbit.r * 1.05 + w2 * f.orbit.r + w3 * f.rest.r;
      const ly = w1 * f.orbit.y + w2 * f.orbit.y + w3 * f.rest.y;
      fam.line.scale.set(lr, 1, lr);
      fam.line.position.y = ly;
      fam.lineMat.opacity = e * (0.5 * w2 + 0.26 * w3) * (key === 'top' ? 0.9 : 1);

      for (let i = 0; i < fam.items.length; i++) {
        const it = fam.items[i];
        it.angle += dt * f.speed * it.spd * spdMul;
        it.rot += dt * spdMul;

        // polar position: scatter → orbit → rest
        const r = w1 * it.r1 + w2 * it.r2 + w3 * it.r3 + Math.sin(time * 0.5 + it.bob) * 0.03 * (1 - w3);
        const bob = Math.sin(time * 0.55 + it.bob) * 0.035 * (1 - 0.75 * w3);
        const y = w1 * it.y1 + w2 * it.y2 + w3 * it.y3 + bob;
        const a = it.angle + wrapPi(it.restA - it.angle) * sm;
        pos.set(Math.cos(a) * r, y, Math.sin(a) * r);

        // orientation: free tumble → resting pose
        eul.set(it.e0[0] + it.es[0] * it.rot, it.e0[1] + it.es[1] * it.rot, it.e0[2] + it.es[2] * it.rot);
        qFree.setFromEuler(eul);
        if (key === 'heart') {
          vx.set(-Math.sin(it.restA), 0, Math.cos(it.restA));
          vy.set(Math.cos(it.restA) * 0.78, 0.82, Math.sin(it.restA) * 0.78).normalize();   // open corolla: petals lift ~45° so they face the viewer
          vz.crossVectors(vx, vy).normalize();
          vx.crossVectors(vy, vz).normalize();
          basis.makeBasis(vx, vy, vz);
          qRest.setFromRotationMatrix(basis);
        } else {
          eul.set(0.35, it.restA * 3, 0.15);
          qRest.setFromEuler(eul);
        }
        q.copy(qFree).slerp(qRest, sm);

        const appear = smooth(0, 0.45, intro * 1.5 - it.stagger);
        const sz = it.size * appear * (1 + 0.04 * Math.sin(time * 0.8 + it.bob));
        scl.setScalar(Math.max(sz, 0.0001));
        mat4.compose(pos, q, scl);
        fam.mesh.setMatrixAt(i, mat4);
      }
      fam.mesh.instanceMatrix.needsUpdate = true;
    }

    // canvas fades in once the bottle has loaded and the stage is arriving
    canvas.style.opacity = bottleReady ? String(clamp(e * 1.4)) : '0';

    renderer.render(scene, camera);
  }

  function start() { if (running || disposed) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // only render while the section is near the viewport and the tab is visible
  let inView = false;
  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; (inView && !document.hidden) ? start() : stop(); }, { rootMargin: '150px 0px' });
  io.observe(track);
  const onVis = () => { (inView && !document.hidden) ? start() : stop(); };
  document.addEventListener('visibilitychange', onVis);

  const onLost = (ev) => { ev.preventDefault(); stop(); onError?.(new Error('webgl context lost')); };
  canvas.addEventListener('webglcontextlost', onLost);

  function dispose() {
    disposed = true;
    stop();
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    stage.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('webglcontextlost', onLost);
    const tex = new Set();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) tex.add(v); }); m.dispose(); });
      if (o.isInstancedMesh) o.dispose();
    });
    tex.forEach((t) => t.dispose());
    shadowTex.dispose(); bokehTex.dispose(); envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}
