// Seeded randomness for Island Hopper: one tiny deterministic generator so
// screenshots and replays look the same for the same seed, and the terrain
// never changes between runs.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise in 2D: a hash grid, bilinear interpolation, one octave
// of detail. Used for hills, clouds and sea sparkle.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function hash(ix, iy) {
    return perm[(perm[ix & 255] + iy) & 255] / 255;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    const u = smooth(fx);
    const v = smooth(fy);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
}

// Fractal noise: several octaves of value noise, amplitude halving each time.
export function makeFractalNoise(seed, octaves) {
  const noise = makeNoise2D(seed);
  return function fbm(x, y) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq) * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / total;
  };
}
