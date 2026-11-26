// HUD for Island Hopper: the instruments the pilot flies by.
// One job: draw airspeed, altitude, heading, attitude, throttle, fuel,
// the mission objective and the messages — big, lit and readable at a glance.
// Everything is drawn on the same canvas the world renders to.

import { CONFIG, M_TO_FT } from './config.js';
import { altitudeFt, bearingTo, currentLeg, distanceTo, nextRing } from './missions.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(8, 22, 34, ${alpha ?? 0.62})`;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, size, color, align) {
  ctx.save();
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.fillStyle = color || 'rgba(255,255,255,0.75)';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function bigNumber(ctx, text, x, y, size, color, align) {
  ctx.save();
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.fillStyle = color || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCompass(ctx, plane, mission, W) {
  const cx = W / 2;
  const y = 14;
  const w = 420;
  const h = 52;
  panel(ctx, cx - w / 2, y, w, h, 0.62);
  const headingDeg = ((plane.heading * 180) / Math.PI + 360) % 360;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y, w, h);
  ctx.clip();
  // Tape: ticks every 10 degrees, labels every 30.
  for (let d = -60; d <= 60; d += 5) {
    let deg = Math.round(headingDeg) + d;
    deg = ((deg % 360) + 360) % 360;
    const x = cx + d * 3.2;
    const major = deg % 30 === 0;
    const mid = deg % 10 === 0;
    ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 8);
    ctx.lineTo(x, y + h - (major ? 22 : mid ? 16 : 11));
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      label(ctx, names[deg] || String(deg).padStart(3, '0'), x, y + 22, 15, '#ffffff', 'center');
    }
  }
  ctx.restore();
  // Centre caret and the live heading readout.
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 7, y + h - 2);
  ctx.lineTo(cx + 7, y + h - 2);
  ctx.lineTo(cx, y + h - 12);
  ctx.closePath();
  ctx.fill();
  bigNumber(ctx, String(Math.round(headingDeg)).padStart(3, '0') + '°', cx, y + h + 26, 22, '#ffffff', 'center');
  // Bearing marker to the next objective, gold diamond on the tape.
  const ring = nextRing(mission);
  const leg = currentLeg(mission);
  let target = null;
  if (ring) target = { x: ring.x, z: ring.z };
  else if (leg) target = CONFIG.strips[leg.to];
  if (target && mission.state === 'flying') {
    const b = bearingTo(plane, target.x, target.z);
    let diff = ((b - headingDeg + 540) % 360) - 180;
    if (Math.abs(diff) <= 60) {
      const x = cx + diff * 3.2;
      ctx.fillStyle = CONFIG.palette.ringNext;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + 6, y + 12);
      ctx.lineTo(x, y + 18);
      ctx.lineTo(x - 6, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawAirspeed(ctx, plane, H) {
  const x = 16;
  const y = 16;
  panel(ctx, x, y, 150, 92, 0.62);
  label(ctx, 'AIRSPEED', x + 12, y + 22, 13);
  bigNumber(ctx, String(Math.round(plane.speedKts)), x + 12, y + 62, 40);
  label(ctx, 'KTS', x + 104, y + 62, 14, CONFIG.palette.hudAmber);
  const bar = clamp(plane.speedKts / CONFIG.plane.maxSpeedKts, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 12, y + 74, 126, 6);
  ctx.fillStyle = plane.speedKts < CONFIG.plane.stallSpeedKts + 8 ? CONFIG.palette.hudRed : CONFIG.palette.hudGreen;
  ctx.fillRect(x + 12, y + 74, 126 * bar, 6);
}

function drawAltitude(ctx, plane, W) {
  const x = W - 166;
  const y = 16;
  panel(ctx, x, y, 150, 92, 0.62);
  label(ctx, 'ALTITUDE', x + 12, y + 22, 13);
  bigNumber(ctx, altitudeFt(plane).toLocaleString('en-US'), x + 12, y + 62, 40);
  label(ctx, 'FT', x + 118, y + 62, 14, CONFIG.palette.hudAmber);
  const vs = Math.round(plane.verticalSpeedFpm);
  const arrow = vs > 60 ? '▲ +' : vs < -60 ? '▼ −' : '—';
  label(ctx, `${arrow}${Math.abs(vs)} FPM`, x + 12, y + 88, 13, vs < -900 ? CONFIG.palette.hudRed : 'rgba(255,255,255,0.8)');
}

function drawAttitude(ctx, plane, W, H) {
  const cx = 92;
  const cy = H - 92;
  const r = 66;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * 130;
  ctx.fillStyle = '#5fa8dd';
  ctx.fillRect(-r - 4, -r - 4 - pitchPx, (r + 4) * 2, r + 4 + pitchPx);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r - 4, -pitchPx, (r + 4) * 2, r + 4 + pitchPx);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  for (const p of [-0.3, -0.15, 0, 0.15, 0.3]) {
    const yy = -p * 130 - pitchPx;
    ctx.beginPath();
    ctx.moveTo(-r * (p === 0 ? 0.9 : 0.45), yy);
    ctx.lineTo(r * (p === 0 ? 0.9 : 0.45), yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Fixed wings: the plane symbol never rolls.
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillRect(cx - 34, cy - 3, 26, 6);
  ctx.fillRect(cx + 8, cy - 3, 26, 6);
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  label(ctx, 'ATTITUDE', cx - r, cy + r + 18, 12, 'rgba(255,255,255,0.7)', 'left');
}

function drawThrottleFuel(ctx, plane, W, H) {
  const x = W - 176;
  const y = H - 178;
  panel(ctx, x, y, 160, 162, 0.62);
  label(ctx, 'THROTTLE', x + 12, y + 22, 13);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 12, y + 32, 136, 12);
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillRect(x + 12, y + 32, 136 * plane.throttle, 12);
  label(ctx, `${Math.round(plane.throttle * 100)}%`, x + 12, y + 64, 15, '#ffffff');
  label(ctx, 'FUEL', x + 12, y + 92, 13);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 12, y + 102, 136, 12);
  ctx.fillStyle = plane.fuel < 20 ? CONFIG.palette.hudRed : CONFIG.palette.hudGreen;
  ctx.fillRect(x + 12, y + 102, 136 * (plane.fuel / 100), 12);
  label(ctx, `${Math.round(plane.fuel)}%  ${plane.fuel < 20 ? '— LOW FUEL' : ''}`, x + 12, y + 136, 14, plane.fuel < 20 ? CONFIG.palette.hudRed : '#ffffff');
  label(ctx, `${plane.gearDown ? 'GEAR DOWN' : 'GEAR UP'}  •  ${plane.flaps ? 'FLAPS' : 'CLEAN'}`, x + 12, y + 156, 12, 'rgba(255,255,255,0.7)');
}

function drawObjective(ctx, plane, mission, W) {
  const leg = currentLeg(mission);
  if (!leg) return;
  const ring = nextRing(mission);
  let text = '';
  if (mission.state === 'flying' && ring) {
    const d = Math.round(distanceTo(plane, ring.x, ring.z));
    text = `${leg.name}  •  Ring ${mission.ringIndex + 1}/${leg.rings.length}  •  ${d.toLocaleString('en-US')} m`;
  } else if (mission.state === 'flying') {
    const dest = CONFIG.strips[leg.to];
    const d = Math.round(distanceTo(plane, dest.x, dest.z));
    text = `${leg.name}  •  Land at ${dest.name}  •  ${d.toLocaleString('en-US')} m`;
  } else if (mission.state === 'landed') {
    text = `${leg.name} — leg complete`;
  }
  if (!text) return;
  ctx.save();
  ctx.font = '700 17px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 28;
  panel(ctx, W / 2 - w / 2, 96, w, 34, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W / 2, 119);
  ctx.restore();
}

function drawScore(ctx, mission, W) {
  panel(ctx, W - 166, 120, 150, 46, 0.55);
  label(ctx, 'SCORE', W - 154, 140, 12);
  bigNumber(ctx, String(mission.score), W - 154, 158, 24, CONFIG.palette.hudAmber);
}

// Score line drawn under the score box (kept separate so the box stays small).
function drawScoreSub(ctx, mission, W) {
  label(ctx, `Rings ${mission.ringsHit}   Landings ${mission.landings}`, W - 16, 186, 13, 'rgba(255,255,255,0.85)', 'right');
}

function drawMessage(ctx, mission, now, W, H) {
  if (!mission.message || now > mission.messageUntil) return;
  const text = mission.message;
  ctx.save();
  ctx.font = '700 21px system-ui, sans-serif';
  const w = Math.min(W - 60, ctx.measureText(text).width + 36);
  panel(ctx, W / 2 - w / 2, H * 0.42, w, 44, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W / 2, H * 0.42 + 29);
  ctx.restore();
}

function drawWarnings(ctx, plane, W, H) {
  const warnings = [];
  if (!plane.onGround && plane.speedKts < CONFIG.plane.stallSpeedKts) warnings.push('STALL — NOSE DOWN, ADD POWER');
  if (plane.fuel > 0 && plane.fuel < 15) warnings.push('LOW FUEL');
  if (plane.damage > 0 && plane.damage < 100) warnings.push(`DAMAGE ${Math.round(plane.damage)}%`);
  if (warnings.length === 0) return;
  ctx.save();
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.palette.hudRed;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  warnings.forEach((w, i) => ctx.fillText(w, W / 2, H * 0.30 + i * 28));
  ctx.restore();
}

function drawTitle(ctx, W, H, mission) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.fillText('ISLAND HOPPER', W / 2, H * 0.30);
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillText('Sky Courier of the Coral Isles', W / 2, H * 0.30 + 38);
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const lines = [
    'Fly the mail run: three legs, eighteen rings, three island airstrips.',
    'Watch your fuel — a dry tank means a glide, and a hard landing means a crash.',
    '',
    'Arrows / WASD — pitch and roll      Shift — throttle up      Ctrl — throttle down',
    'Mouse — steer like a yoke      Space — brake      F — flaps      G — gear      P — pause      M — sound',
    '',
    'Press ENTER to take off',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + i * 28));
  ctx.restore();
}

function drawEndCard(ctx, W, H, title, lines) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H * 0.36);
  ctx.font = '600 21px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + i * 32));
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillText('Press R to fly again', W / 2, H * 0.44 + lines.length * 32 + 18);
  ctx.restore();
}

// The whole HUD, in draw order. `screen` is 'title' | 'play' | 'crashed' | 'complete'.
export function drawHud(ctx, plane, mission, W, H, now, screen) {
  drawCompass(ctx, plane, mission, W);
  drawAirspeed(ctx, plane, H);
  drawAltitude(ctx, plane, W);
  drawAttitude(ctx, plane, W, H);
  drawThrottleFuel(ctx, plane, W, H);
  drawObjective(ctx, plane, mission, W);
  drawScore(ctx, mission, W);
  drawScoreSub(ctx, mission, W);
  drawWarnings(ctx, plane, W, H);
  if (screen !== 'title') drawMessage(ctx, mission, now, W, H);
  if (screen === 'title') drawTitle(ctx, W, H, mission);
  if (screen === 'crashed') {
    drawEndCard(ctx, W, H, 'CRASHED', [
      `Score ${mission.score} — the courier is down.`,
      'Mind your descent rate and keep her above stall speed.',
    ]);
  }
  if (screen === 'complete') {
    drawEndCard(ctx, W, H, 'ROUTE COMPLETE', [
      `Final score ${mission.score} — all three legs flown.`,
      `Rings ${mission.ringsHit} of 18  •  Landings ${mission.landings} of 3`,
      `Flight time ${Math.round(mission.totalTime / 60)} min ${Math.round(mission.totalTime % 60)} s`,
    ]);
  }
}
