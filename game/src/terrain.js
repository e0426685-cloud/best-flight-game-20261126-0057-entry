// Terrain of the Coral Isles: a small archipelago the game flies over.
// One job: answer "how high is the ground here?" and "what colour is it?",
// from a fixed set of seeded islands plus fractal hills. Runways sit on
// flattened pads so a landing always meets level ground.

import { CONFIG } from './config.js';
import { makeFractalNoise, mulberry32 } from './random.js';

// Island blobs: centre, radius, peak height. The three strips sit on the
// first three islands; the rest are scenery with hills and beaches.
const ISLANDS = [
  { x: 0, z: 250, r: 620, h: 120 },
  { x: 420, z: 2100, r: 520, h: 95 },
  { x: 1150, z: 4050, r: 560, h: 140 },
  { x: -720, z: 1300, r: 430, h: 150 },
  { x: 980, z: 900, r: 380, h: 80 },
  { x: -350, z: 3300, r: 470, h: 170 },
  { x: 1650, z: 2900, r: 400, h: 110 },
];

const hills = makeFractalNoise(20261126, 4);
const detail = makeFractalNoise(77, 3);
const sparkleRand = mulberry32(4242);

// Pre-computed sparkle dots for the sea, in world space.
const SPARKLES = [];
for (let i = 0; i < 260; i++) {
  SPARKLES.push({
    x: (sparkleRand() - 0.5) * 5200,
    z: (sparkleRand() - 0.5) * 5200 + 2000,
    s: 0.6 + sparkleRand() * 1.8,
  });
}

function smoothstep(a, b, t) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

// Height of the ground in metres at world (x, z). Sea level is 0.
export function groundHeight(x, z) {
  let h = -6; // seabed
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isl.r;
    if (d < 1.25) {
      const fall = Math.max(0, 1 - d * d);
      h = Math.max(h, fall * fall * isl.h);
    }
  }
  // Rolling hills on land, gentle swell under water.
  const n = hills(x * 0.0016, z * 0.0016);
  const d2 = detail(x * 0.006, z * 0.006);
  if (h > 0) h += n * 26 + d2 * 6;
  else h += n * 2;
  // Flatten a broad, level apron under every airstrip so the runway is level
  // ground and the approach stays clear of the hills around it.
  for (const strip of Object.values(CONFIG.strips)) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const pad = smoothstep(strip.lengthM * 1.25, strip.lengthM * 0.45, d);
    if (pad > 0 && h > 0) h = h * (1 - pad) + 5 * pad; // land only: the sea stays sea
  }
  return h;
}

// Colour of the ground at (x, z) for height h. Returns [r, g, b].
export function groundColor(x, z, h) {
  const p = CONFIG.palette;
  const hex = (s) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
  const seaDeep = hex(p.seaDeep);
  const seaShallow = hex(p.seaShallow);
  const sand = hex(p.sand);
  const grass = hex(p.grass);
  const forest = hex(p.forest);
  const rock = hex(p.rock);
  const snow = hex(p.snow);
  if (h < -1) {
    // Shallow water near shore fades to deep blue further out.
    const t = smoothstep(-1, -14, h);
    return mix(seaShallow, seaDeep, t);
  }
  if (h < 3) return mix(sand, grass, smoothstep(1, 3, h));
  if (h < 55) {
    const patch = detail(x * 0.02, z * 0.02) * 0.5 + 0.5;
    return mix(grass, forest, smoothstep(0.25, 0.75, patch));
  }
  if (h < 120) return mix(forest, rock, smoothstep(55, 120, h));
  return mix(rock, snow, smoothstep(120, 165, h));
}

export function seaSparkles() {
  return SPARKLES;
}

// Is world (x, z) on the named strip's paved surface? Used for landings.
export function onStrip(x, z, strip) {
  const heading = (strip.headingDeg * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  const along = dx * Math.sin(heading) + dz * Math.cos(heading);
  const across = dx * Math.cos(heading) - dz * Math.sin(heading);
  return (
    Math.abs(along) <= strip.lengthM / 2 &&
    Math.abs(across) <= strip.widthM / 2 + CONFIG.plane.runwayMarginM
  );
}
