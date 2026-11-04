# The Craft — scroll-driven 3D (Story page)

| File | Role |
|---|---|
| `src/components/CraftExperience.jsx` | Pinned section markup, step state, click-to-stage, static fallback (reduced motion / no WebGL) |
| `src/three/craftScene.js` | three.js scene: loads the bottle, builds the notes, maps smoothed scroll progress to every pose |
| `src/styles/craft.css` | Layout, rail, arch, mobile layout |
| `public/models/velora-bottle.glb` | The supplied bottle, optimised 11.3 MB -> 1.3 MB (`scripts/optimize-bottle.mjs`) |

Stage value `s = smooth(.26,.46,p) + smooth(.60,.80,p)`: 0 Choosing, 1 Composing, 2 Resting.

Tuning: `.craft3d-track` height (scroll length), the two `smooth()` ranges, `N` (note counts, full vs lite),
`FAM` (radii/speeds), `BOTTLE_H`, final yaw `lerp(-1.75, 0.07, ep)`.
Three.js is a lazy chunk loaded only on /our-story.
