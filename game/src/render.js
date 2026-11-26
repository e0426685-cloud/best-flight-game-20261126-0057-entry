// Renderer for Island Hopper: a chase view over the Coral Isles.
// One job: turn the plane and the world into a picture on the canvas — sky,
// sun, clouds, projected terrain, runways, rings and the plane itself.
// Nothing here moves the plane or keeps score.

import { CONFIG } from './config.js';
import { groundHeight, groundColor, seaSparkles } from './terrain.js';
import { mulberry32 } from './random.js';

// Clouds live in world space so they sit still while the plane flies.
const cloudRand = mulberry32(20261126);
const CLOUDS = [];
for (let i = 0; i < 46; i++) {
  CLOUDS.push({
    x: (cloudRand() - 0.5) * 5600,
    y: 520 + cloudRand() * 420,
    z: (cloudRand() - 0.5) * 5600 + 2000,
    s: 60 + cloudRand() * 130,
  });
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Build a camera from the plane: behind it, above it, looking ahead.
export function makeCamera(plane, W, H) {
  const C = CONFIG.camera;
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  const rx = Math.cos(plane.heading);
  const rz = -Math.sin(plane.heading);
  const camX = plane.x - fx * C.distanceM;
  const camY = plane.y + C.heightM;
  const camZ = plane.z - fz * C.distanceM;
  // Look at a point ahead of the plane, slightly below it.
  const lookX = plane.x + fx * 60;
  const lookY = plane.y - 6;
  const lookZ = plane.z + fz * 60;
  let fwdX = lookX - camX;
  let fwdY = lookY - camY;
  let fwdZ = lookZ - camZ;
  const fl = Math.hypot(fwdX, fwdY, fwdZ);
  fwdX /= fl;
  fwdY /= fl;
  fwdZ /= fl;
  // right = worldUp x fwd, up = fwd x right (world up is +y).
  let rX = 1 * fwdZ - 0 * fwdY;
  let rY = 0 * fwdX - 0 * fwdZ;
  let rZ = 0 * fwdY - 1 * fwdX;
  const rl = Math.hypot(rX, rY, rZ) || 1;
  rX /= rl;
  rY /= rl;
  rZ /= rl;
  const uX = fwdY * rZ - fwdZ * rY;
  const uY = fwdZ * rX - fwdX * rZ;
  const uZ = fwdX * rY - fwdY * rX;
  const focal = H / 2 / Math.tan(((CONFIG.camera.fovDeg / 2) * Math.PI) / 180);
  return {
    x: camX,
    y: camY,
    z: camZ,
    fwd: [fwdX, fwdY, fwdZ],
    right: [rX, rY, rZ],
    up: [uX, uY, uZ],
    focal,
    W,
    H,
  };
}

// Project a world point to screen space. Returns null when behind camera.
export function project(cam, px, py, pz) {
  const vx = px - cam.x;
  const vy = py - cam.y;
  const vz = pz - cam.z;
  const cz = vx * cam.fwd[0] + vy * cam.fwd[1] + vz * cam.fwd[2];
  if (cz < 2) return null;
  const cx = vx * cam.right[0] + vy * cam.right[1] + vz * cam.right[2];
  const cy = vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2];
  const s = cam.focal / cz;
  return { x: cam.W / 2 + cx * s, y: cam.H * 0.52 - cy * s, depth: cz, scale: s };
}

// Same projection, but points behind the camera are clamped to just in front
// of it instead of vanishing: terrain quads straddling the camera then fill
// the bottom of the screen instead of leaving a gap. Only for ground.
function projectGround(cam, px, py, pz) {
  const vx = px - cam.x;
  const vy = py - cam.y;
  const vz = pz - cam.z;
  const cz = Math.max(2, vx * cam.fwd[0] + vy * cam.fwd[1] + vz * cam.fwd[2]);
  const cx = vx * cam.right[0] + vy * cam.right[1] + vz * cam.right[2];
  const cy = vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2];
  const s = cam.focal / cz;
  return { x: cam.W / 2 + cx * s, y: cam.H * 0.52 - cy * s, depth: cz, scale: s };
}

function drawSky(ctx, cam, W, H, time) {
  const p = CONFIG.palette;
  const horizon = project(cam, cam.x + cam.fwd[0] * 1000, cam.y, cam.z + cam.fwd[2] * 1000);
  const horizonY = horizon ? horizon.y : H * 0.52;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.45, p.skyMid);
  g.addColorStop(0.62, p.skyHorizon);
  g.addColorStop(0.621, p.seaDeep);
  g.addColorStop(1, '#14486b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Sun: fixed in the sky to the north-east, with a warm glow.
  const sunDir = [0.55, 0.5, 0.45];
  const sun = project(cam, cam.x + sunDir[0] * 4000, cam.y + sunDir[1] * 4000, cam.z + sunDir[2] * 4000);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 150);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,226,140,0.55)');
    glow.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 160, sun.y - 160, 320, 320);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  return horizonY;
}

function drawClouds(ctx, cam, time) {
  ctx.save();
  for (const c of CLOUDS) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.depth > 4200) continue;
    const s = c.s * p.scale;
    if (s < 4) continue;
    const alpha = clamp(1 - p.depth / 4200, 0.15, 0.85);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - s * 0.5, p.y + s * 0.1, s * 0.6, s * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + s * 0.55, p.y + s * 0.08, s * 0.65, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTerrain(ctx, cam, plane, horizonY) {
  const p = CONFIG.palette;
  const horizonRgb = hexToRgb(p.skyHorizon);
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  const rx = Math.cos(plane.heading);
  const rz = -Math.sin(plane.heading);
  const rows = 42;
  const cols = 26;
  const halfWidth = 950;
  // Distances ahead of the plane: near rows tight, far rows wide apart.
  const dists = [];
  let d = -60;
  for (let i = 0; i <= rows; i++) {
    dists.push(d);
    d += 16 * Math.pow(1.115, i);
  }
  // Cache projected corners row by row, far to near so near quads overlap.
  const pts = [];
  for (let i = 0; i <= rows; i++) {
    const row = [];
    for (let j = 0; j <= cols; j++) {
      const lat = -halfWidth + (2 * halfWidth * j) / cols;
      const wx = plane.x + fx * dists[i] + rx * lat;
      const wz = plane.z + fz * dists[i] + rz * lat;
      const wy = groundHeight(wx, wz);
      row.push({ p: projectGround(cam, wx, wy, wz), h: wy, x: wx, z: wz });
    }
    pts.push(row);
  }
  for (let i = rows; i >= 1; i--) {
    for (let j = 0; j < cols; j++) {
      const a = pts[i - 1][j];
      const b = pts[i - 1][j + 1];
      const c = pts[i][j + 1];
      const e = pts[i][j];
      if (!a.p || !b.p || !c.p || !e.p) continue;
      if (a.p.y < horizonY - 2 && b.p.y < horizonY - 2 && c.p.y < horizonY - 2 && e.p.y < horizonY - 2) {
        continue; // whole quad above the horizon: sky, not ground
      }
      const h = (a.h + b.h + c.h + e.h) / 4;
      let col = groundColor((a.x + c.x) / 2, (a.z + c.z) / 2, h);
      // Aerial perspective: distant ground fades toward the horizon colour.
      const depth = (a.p.depth + c.p.depth) / 2;
      col = mixRgb(col, horizonRgb, clamp((depth - 700) / 3200, 0, 0.72));
      ctx.fillStyle = rgb(col);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Sea sparkle: a few glints where the sun catches the water.
  ctx.save();
  for (const s of seaSparkles()) {
    if (groundHeight(s.x, s.z) > -0.5) continue;
    const p = project(cam, s.x, 0.5, s.z);
    if (!p || p.depth < 30 || p.depth > 2600) continue;
    const tw = 0.5 + 0.5 * Math.sin(plane.time * 2 + s.x * 0.05 + s.z * 0.03);
    ctx.fillStyle = `rgba(255,255,240,${(0.35 * tw).toFixed(2)})`;
    ctx.fillRect(p.x, p.y, s.s * p.scale + 1, 1.6);
  }
  ctx.restore();
}

function drawRunway(ctx, cam, strip) {
  const p = CONFIG.palette;
  const heading = (strip.headingDeg * Math.PI) / 180;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const half = strip.widthM / 2;
  const segs = 10;
  const gy = 5.8; // just above the strip pad's 5 m level ground
  for (let i = 0; i < segs; i++) {
    const t0 = -strip.lengthM / 2 + (strip.lengthM * i) / segs;
    const t1 = -strip.lengthM / 2 + (strip.lengthM * (i + 1)) / segs;
    const corners = [
      project(cam, strip.x + fx * t0 + rx * -half, gy, strip.z + fz * t0 + rz * -half),
      project(cam, strip.x + fx * t0 + rx * half, gy, strip.z + fz * t0 + rz * half),
      project(cam, strip.x + fx * t1 + rx * half, gy, strip.z + fz * t1 + rz * half),
      project(cam, strip.x + fx * t1 + rx * -half, gy, strip.z + fz * t1 + rz * -half),
    ];
    if (corners.some((c) => !c)) continue;
    ctx.fillStyle = i % 2 === 0 ? p.runway : '#41474f';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dash.
    if (i % 2 === 0) {
      const mid0 = (t0 + t1) / 2 - strip.lengthM / segs / 4;
      const mid1 = (t0 + t1) / 2 + strip.lengthM / segs / 4;
      const d = [
        project(cam, strip.x + fx * mid0 + rx * -1.2, gy + 0.15, strip.z + fz * mid0 + rz * -1.2),
        project(cam, strip.x + fx * mid0 + rx * 1.2, gy + 0.15, strip.z + fz * mid0 + rz * 1.2),
        project(cam, strip.x + fx * mid1 + rx * 1.2, gy + 0.15, strip.z + fz * mid1 + rz * 1.2),
        project(cam, strip.x + fx * mid1 + rx * -1.2, gy + 0.15, strip.z + fz * mid1 + rz * -1.2),
      ];
      if (d.every(Boolean)) {
        ctx.fillStyle = p.runwayEdge;
        ctx.beginPath();
        ctx.moveTo(d[0].x, d[0].y);
        for (const q of d.slice(1)) ctx.lineTo(q.x, q.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // Strip name floating over the far threshold.
  const label = project(cam, strip.x + fx * (strip.lengthM / 2 + 60), 42, strip.z + fz * (strip.lengthM / 2 + 60));
  if (label && label.depth < 2400) {
    ctx.save();
    ctx.font = `bold ${Math.max(13, Math.min(26, 9000 / label.depth))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(20,40,60,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(strip.name, label.x, label.y);
    ctx.fillText(strip.name, label.x, label.y);
    ctx.restore();
  }
}

function drawRing(ctx, cam, ring, isNext, time) {
  const p = CONFIG.palette;
  const centre = project(cam, ring.x, ring.altFt * 0.3048, ring.z);
  if (!centre || centre.depth < 4) return;
  const radius = ring.r * centre.scale;
  if (radius < 2) return;
  const pulse = isNext ? 1 + 0.06 * Math.sin(time * 5) : 1;
  const r = radius * pulse;
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.strokeStyle = isNext ? p.ringNext : 'rgba(255,255,255,0.75)';
  ctx.globalAlpha = isNext ? 1 : 0.55;
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, r, r * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, r * 0.88, r * 0.83, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Number tag above the ring so the pilot can count the course.
  if (r > 14) {
    ctx.globalAlpha = 1;
    ctx.font = `bold ${Math.max(13, Math.round(r * 0.42))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isNext ? '#fff3c4' : 'rgba(255,255,255,0.8)';
    ctx.fillText(String(ring.label || ''), centre.x, centre.y - r - 8);
  }
  ctx.restore();
}

// The bush plane, drawn in screen space, banked with the roll. On the title
// screen it sits smaller and lower so the title text clears it.
function drawPlane(ctx, cam, plane, W, H, mode) {
  const p = CONFIG.palette;
  const cx = W / 2;
  const cy = mode === 'title' ? H * 0.68 : H * 0.60;
  const scale = (Math.min(W, H) / 620) * (mode === 'title' ? 0.8 : 1);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.85);
  ctx.scale(scale, scale);
  // Shadow of the wings on the fuselage side, then the wings.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 150, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings: high wing, slightly swept, white with red tips.
  ctx.fillStyle = p.planeWing;
  ctx.beginPath();
  ctx.moveTo(-168, 6);
  ctx.lineTo(-30, -14);
  ctx.lineTo(30, -14);
  ctx.lineTo(168, 6);
  ctx.lineTo(150, 26);
  ctx.lineTo(-150, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.planeBody;
  ctx.beginPath();
  ctx.moveTo(-168, 6);
  ctx.lineTo(-150, 26);
  ctx.lineTo(-138, 24);
  ctx.lineTo(-152, 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(168, 6);
  ctx.lineTo(150, 26);
  ctx.lineTo(138, 24);
  ctx.lineTo(152, 8);
  ctx.closePath();
  ctx.fill();
  // Fuselage: tapered body seen from behind and above.
  ctx.fillStyle = p.planeBody;
  ctx.beginPath();
  ctx.moveTo(0, -96);
  ctx.quadraticCurveTo(26, -60, 22, 10);
  ctx.quadraticCurveTo(20, 52, 10, 74);
  ctx.lineTo(-10, 74);
  ctx.quadraticCurveTo(-20, 52, -22, 10);
  ctx.quadraticCurveTo(-26, -60, 0, -96);
  ctx.fill();
  // Belly stripe.
  ctx.fillStyle = p.planeTrim;
  ctx.beginPath();
  ctx.moveTo(-20, 30);
  ctx.quadraticCurveTo(0, 40, 20, 30);
  ctx.lineTo(16, 52);
  ctx.quadraticCurveTo(0, 60, -16, 52);
  ctx.closePath();
  ctx.fill();
  // Cockpit windows, lit.
  ctx.fillStyle = '#bfe6ff';
  ctx.beginPath();
  ctx.moveTo(-13, -62);
  ctx.lineTo(13, -62);
  ctx.lineTo(17, -34);
  ctx.lineTo(-17, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-11, -58, 5, 20);
  // Tail: horizontal stabiliser and vertical fin.
  ctx.fillStyle = p.planeWing;
  ctx.beginPath();
  ctx.moveTo(-64, 62);
  ctx.lineTo(-12, 52);
  ctx.lineTo(12, 52);
  ctx.lineTo(64, 62);
  ctx.lineTo(56, 76);
  ctx.lineTo(-56, 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.planeBody;
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.lineTo(14, 78);
  ctx.lineTo(-14, 78);
  ctx.closePath();
  ctx.fill();
  // Navigation lights: red port, green starboard, white tail.
  ctx.fillStyle = '#ff4d3d';
  ctx.beginPath();
  ctx.arc(-166, 15, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e07a';
  ctx.beginPath();
  ctx.arc(166, 15, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 78, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ground shadow: a soft ellipse under the plane on the terrain.
  const g = groundHeight(plane.x, plane.z);
  const shadow = project(cam, plane.x, g + 1, plane.z);
  if (shadow && shadow.depth > 2) {
    const alt = Math.max(0, plane.y - g);
    const s = clamp(90 - alt * 0.06, 8, 90) * shadow.scale * 12;
    ctx.save();
    ctx.fillStyle = `rgba(10,30,40,${clamp(0.4 - alt / 900, 0.06, 0.4).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, Math.max(3, s), Math.max(2, s * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Full frame: sky, clouds, terrain, strips, rings, plane.
export function renderScene(ctx, plane, mission, W, H, time, mode) {
  const cam = makeCamera(plane, W, H);
  const horizonY = drawSky(ctx, cam, W, H, time);
  drawClouds(ctx, cam, time);
  drawTerrain(ctx, cam, plane, horizonY);
  for (const strip of Object.values(CONFIG.strips)) {
    const d = Math.hypot(strip.x - plane.x, strip.z - plane.z);
    if (d < 3400) drawRunway(ctx, cam, strip);
  }
  const leg = CONFIG.legs[mission.legIndex];
  if (leg) {
    const rings = leg.rings
      .map((r, i) => ({ ...r, label: i + 1, done: i < mission.ringIndex }))
      .filter((r) => !r.done)
      .sort((a, b) => {
        const da = Math.hypot(a.x - plane.x, a.z - plane.z);
        const db = Math.hypot(b.x - plane.x, b.z - plane.z);
        return db - da; // far first so near rings draw on top
      });
    for (const r of rings) drawRing(ctx, cam, r, r.label === mission.ringIndex + 1, time);
  }
  drawPlane(ctx, cam, plane, W, H, mode);
  return cam;
}
