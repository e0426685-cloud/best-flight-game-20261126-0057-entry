// Island Hopper — Sky Courier: entry point and game loop.
// One job: own the canvas, the clock and the screen state (title, flying,
// paused, crashed, complete), and call the flight model, the missions, the
// renderer and the HUD in the right order, every frame.

import { CONFIG, FT_TO_M } from './config.js';
import { createPlane, stepPlane, resetToStrip } from './plane.js';
import { createMission, startLeg, stepMission, currentLeg, nextRing, bearingTo } from './missions.js';
import { renderScene } from './render.js';
import { drawHud } from './hud.js';
import { createInput, readStick, consumePress, clearPresses } from './input.js';
import { createAudio, ensureAudio, updateEngineSound, playRingChime, playLandingThud, playCrashSting, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || '1');

let W = 1280;
let H = 800;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const audio = createAudio();
const mission = createMission();
let plane = createPlane(CONFIG.strips.coral);
let screen = 'title'; // title | play | paused | crashed | complete
let lastTime = performance.now();
let paused = false;
let wasLanded = false;
let wasCrashed = false;
let ringsBefore = 0;

// A gentle autopilot for the title screen and for screenshots: hold the
// plane level, steer toward the next ring, keep the throttle at cruise.
function autopilot(dt) {
  const ring = nextRing(mission);
  let targetBearing = plane.heading;
  let targetAltM = plane.y;
  let pitchBias = 0.05;
  if (ring) {
    targetBearing = (bearingTo(plane, ring.x, ring.z) * Math.PI) / 180;
    targetAltM = ring.altFt * FT_TO_M;
  } else {
    // No ring left: fly the approach to the destination strip, gently down.
    const leg = currentLeg(mission);
    if (leg) {
      const dest = CONFIG.strips[leg.to];
      targetBearing = (bearingTo(plane, dest.x, dest.z) * Math.PI) / 180;
      pitchBias = -0.05;
    }
  }
  let diff = targetBearing - plane.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, diff * 1.4));
  const altErr = targetAltM - plane.y;
  const pitch = Math.max(-1, Math.min(1, altErr * 0.004 + pitchBias));
  return { pitch, roll, throttleDelta: (0.72 - plane.throttle) * 2 * dt * 4, brake: false };
}

// Deterministic setups for screenshots (?shot=...&seed=...): the plane is
// placed mid-action so every shot shows the game at its best.
function applyShot() {
  if (!SHOT) return;
  mission.state = 'flying';
  const coral = CONFIG.strips.coral;
  const turtle = CONFIG.strips.turtle;
  const gull = CONFIG.strips.gull;
  if (SHOT === 'takeoff') {
    plane = createPlane(coral);
    plane.throttle = 0.92;
    plane.speedKts = 88;
    plane.y = 6;
    startLeg(mission, 0);
    mission.message = 'Leg 1 — Coral Bay to Turtle Rock';
    mission.messageUntil = 999;
  } else if (SHOT === 'flight') {
    // Mid-leg 1 on the line from ring 2 to ring 3, the gold ring dead ahead.
    plane = createPlane(coral);
    plane.x = -40;
    plane.y = 1000 * FT_TO_M;
    plane.z = 965;
    plane.heading = 0.87;
    plane.speedKts = 152;
    plane.throttle = 0.74;
    plane.onGround = false;
    startLeg(mission, 0);
    mission.legIndex = 0;
    mission.ringIndex = 2;
    mission.ringsHit = 2;
    mission.score = 500;
    mission.message = 'Ring 3 of 5 — dead ahead';
    mission.messageUntil = 999;
  } else if (SHOT === 'landing') {
    // Short final to Turtle Rock: 150 m out, 150 ft, offset 45 m right of the
    // centreline so the runway shows beside the plane instead of behind it.
    plane = createPlane(turtle);
    plane.x = 394;
    plane.y = 150 * FT_TO_M;
    plane.z = 1758;
    plane.heading = (turtle.headingDeg * Math.PI) / 180;
    plane.speedKts = 90;
    plane.throttle = 0.4;
    plane.pitch = -0.06;
    plane.flaps = true;
    plane.onGround = false;
    startLeg(mission, 0);
    mission.legIndex = 0;
    mission.ringIndex = 5;
    mission.ringsHit = 5;
    mission.score = 1250;
    mission.message = 'Final approach — Turtle Rock';
    mission.messageUntil = 999;
  } else if (SHOT === 'title') {
    plane = createPlane(coral);
    plane.x = 200;
    plane.y = 850 * FT_TO_M;
    plane.z = 700;
    plane.heading = 0.35;
    plane.speedKts = 140;
    plane.throttle = 0.7;
    plane.onGround = false;
    startLeg(mission, 0);
    mission.legIndex = 0;
    screen = 'title';
  }
  if (SHOT && SHOT !== 'title') screen = 'play';
}

applyShot();

function statusLine() {
  const el = document.getElementById('status');
  if (!el) return;
  const leg = currentLeg(mission);
  el.textContent = leg
    ? `${leg.name}. Score ${mission.score}. Speed ${Math.round(plane.speedKts)} knots, altitude ${Math.round(plane.y * 3.28084)} feet.`
    : `Score ${mission.score}.`;
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  const t = now / 1000;

  // One-shot keys.
  if (consumePress(input, 'Enter')) {
    ensureAudio(audio);
    if (screen === 'title') {
      screen = 'play';
      startLeg(mission, t);
    } else if (mission.state === 'landed') {
      const leg = currentLeg(mission);
      resetToStrip(plane, CONFIG.strips[leg.from]);
      startLeg(mission, t);
    }
  }
  if (consumePress(input, 'KeyR')) {
    const leg = currentLeg(mission);
    const strip = mission.state === 'landed' && leg ? CONFIG.strips[leg.from] : CONFIG.strips.coral;
    const fresh = createPlane(strip);
    const keepScore = mission.state === 'complete' ? 0 : mission.score;
    const keepRings = mission.state === 'complete' ? 0 : mission.ringsHit;
    Object.assign(plane, fresh);
    mission.legIndex = mission.state === 'complete' ? 0 : mission.legIndex;
    mission.ringIndex = 0;
    mission.score = keepScore;
    mission.ringsHit = keepRings;
    mission.state = 'flying';
    screen = 'play';
    startLeg(mission, t);
  }
  if (consumePress(input, 'KeyP', 'Escape')) paused = !paused;
  if (consumePress(input, 'KeyM')) toggleMute(audio);
  if (consumePress(input, 'KeyF')) plane.flaps = !plane.flaps;
  if (consumePress(input, 'KeyG')) plane.gearDown = !plane.gearDown;
  if (consumePress(input, 'MouseClick')) ensureAudio(audio);
  if (input.keys.size > 0) ensureAudio(audio);
  clearPresses(input);

  if (!paused) {
    if (screen === 'title' && !SHOT) {
      // The title screen flies itself in a lazy circuit over the bay.
      const stick = autopilot(dt);
      stepPlane(plane, stick, dt);
      if (plane.y < 200) plane.y = 200;
    } else if (screen === 'play') {
      let stick;
      if (SHOT === 'flight' || SHOT === 'landing' || SHOT === 'takeoff') {
        stick = autopilot(dt);
      } else {
        stick = readStick(input);
      }
      ringsBefore = mission.ringsHit;
      stepPlane(plane, stick, dt);
      stepMission(mission, plane, t, dt);
      if (mission.ringsHit > ringsBefore) playRingChime(audio);
      if (plane.landed && !wasLanded) playLandingThud(audio);
      if (plane.crashed && !wasCrashed) playCrashSting(audio);
      wasLanded = plane.landed;
      wasCrashed = plane.crashed;
      if (mission.state === 'crashed') screen = 'crashed';
      if (mission.state === 'complete') screen = 'complete';
    }
  }

  updateEngineSound(audio, plane.throttle, plane.speedKts, plane.onGround);
  renderScene(ctx, plane, mission, W, H, t, screen === 'title' ? 'title' : 'play');
  drawHud(ctx, plane, mission, W, H, t, screen === 'play' || screen === 'paused' ? 'play' : screen);
  if (paused && screen === 'play') {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 20, 32, 0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText('Press P to keep flying', W / 2, H / 2 + 34);
    ctx.restore();
  }
  statusLine();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
