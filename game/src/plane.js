// Flight model for Island Hopper: the numbers behind the stick.
// One job: take the pilot's inputs and the clock, and move the plane through
// the sky — speed, pitch, roll, heading, fuel and damage — nothing drawn here.

import { CONFIG, KTS_TO_MS, M_TO_FT } from './config.js';
import { groundHeight, onStrip } from './terrain.js';

export function createPlane(strip) {
  const heading = (strip.headingDeg * Math.PI) / 180;
  return {
    // Position in metres (x east, y up, z north), heading in radians.
    x: strip.x,
    y: 4,
    z: strip.z - strip.lengthM / 2 + 30,
    heading,
    pitch: 0,
    roll: 0,
    speedKts: 0,
    throttle: 0,
    fuel: CONFIG.plane.fuelCapacity,
    damage: 0,
    verticalSpeedFpm: 0,
    onGround: true,
    gearDown: true,
    flaps: false,
    crashed: false,
    landed: false,
    time: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// inputs: { pitch: -1..1 (stick back = climb), roll: -1..1,
//           throttleDelta: -1..1, brake: bool, dt seconds }
export function stepPlane(plane, inputs, dt) {
  const P = CONFIG.plane;
  plane.time += dt;

  // Throttle: stick or keys move it, it stays where the pilot leaves it.
  plane.throttle = clamp(plane.throttle + inputs.throttleDelta * dt * 0.7, 0, 1);
  if (inputs.brake) plane.throttle = Math.max(0, plane.throttle - dt * 1.5);

  // Roll and pitch answer the stick at once, then ease back toward level.
  const rollTarget = clamp(inputs.roll, -1, 1) * P.rollMax;
  const pitchTarget = clamp(inputs.pitch, -1, 1) * P.pitchMax;
  plane.roll += (rollTarget - plane.roll) * Math.min(1, P.rollSpeed * dt);
  plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, P.pitchSpeed * dt);
  if (Math.abs(inputs.roll) < 0.05) plane.roll *= Math.max(0, 1 - dt * 0.9);
  if (Math.abs(inputs.pitch) < 0.05) plane.pitch *= Math.max(0, 1 - dt * 0.5);

  // Speed chases the throttle setting; climbing costs speed, diving buys it.
  let targetKts = plane.throttle * P.maxSpeedKts;
  targetKts -= Math.sin(plane.pitch) * 55;
  if (plane.flaps) targetKts -= 18;
  const rate = P.accelPerSec * (targetKts > plane.speedKts ? 1 : 0.55);
  plane.speedKts += clamp(targetKts - plane.speedKts, -rate * dt, rate * dt);
  plane.speedKts = Math.max(0, plane.speedKts);

  // Turning follows the bank: steeper bank, tighter turn.
  plane.heading += Math.sin(plane.roll) * P.turnRatePerRoll * (plane.speedKts / 120) * dt;

  // Stall: below flying speed the nose drops and the plane sinks.
  const stalled = plane.speedKts < P.stallSpeedKts && !plane.onGround;
  const climbMs = plane.speedKts * KTS_TO_MS * Math.sin(plane.pitch) * P.climbFactor;
  const sinkMs = stalled ? (P.stallSpeedKts - plane.speedKts) * KTS_TO_MS * 0.9 : 0;
  const prevY = plane.y;
  const speedMs = plane.speedKts * KTS_TO_MS;
  plane.x += Math.sin(plane.heading) * speedMs * Math.cos(plane.pitch) * dt;
  plane.z += Math.cos(plane.heading) * speedMs * Math.cos(plane.pitch) * dt;
  plane.y += (climbMs - sinkMs) * dt;
  plane.verticalSpeedFpm = ((plane.y - prevY) / Math.max(dt, 1e-6)) * M_TO_FT * 60;

  // Fuel burns with throttle; an empty tank means a glide, not a fall.
  if (plane.throttle > 0 && plane.fuel > 0) {
    plane.fuel = Math.max(0, plane.fuel - plane.throttle * P.fuelBurnPerSec * dt);
    if (plane.fuel === 0) plane.throttle = 0;
  }

  // Ground contact: runway landing, rough-field landing, or crash.
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y <= ground + 0.4) {
    plane.y = ground + 0.4;
    const descent = -plane.verticalSpeedFpm;
    const hard = descent > P.safeDescentFpm || plane.speedKts > P.safeTouchdownKts + 45;
    const strip = Object.values(CONFIG.strips).find((s) => onStrip(plane.x, plane.z, s));
    if (!plane.onGround) {
      if (strip && !hard && plane.speedKts < P.safeTouchdownKts + 45) {
        plane.landed = true;
        plane.onGround = true;
        plane.speedKts = Math.min(plane.speedKts, 70);
      } else {
        plane.damage += P.damagePerHardHit + (hard ? 18 : 0);
        if (plane.damage >= 100) {
          plane.crashed = true;
          plane.speedKts = 0;
        } else {
          plane.onGround = true;
          plane.speedKts *= 0.4;
        }
      }
    }
    if (plane.onGround) {
      // Rolling: drag and brakes bleed speed off on the ground.
      plane.speedKts = Math.max(0, plane.speedKts - (inputs.brake ? 55 : 14) * dt);
      plane.pitch = 0;
      plane.roll *= Math.max(0, 1 - dt * 3);
    }
  } else {
    plane.onGround = false;
    plane.landed = false;
  }
  return plane;
}

export function resetToStrip(plane, strip) {
  const fresh = createPlane(strip);
  Object.assign(plane, fresh);
}
