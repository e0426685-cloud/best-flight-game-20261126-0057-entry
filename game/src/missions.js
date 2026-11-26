// Missions for Island Hopper: legs, rings, landings and the score.
// One job: know what the pilot has to do next, notice when they do it, and
// keep the score. It never draws anything and never moves the plane.

import { CONFIG, FT_TO_M, M_TO_FT } from './config.js';
import { onStrip } from './terrain.js';

export function createMission() {
  return {
    legIndex: 0,
    ringIndex: 0,
    score: 0,
    ringsHit: 0,
    landings: 0,
    legStartTime: 0,
    totalTime: 0,
    state: 'brief', // brief | flying | landed | complete | crashed
    message: '',
    messageUntil: 0,
    lastEvent: '',
    bestLanding: null,
  };
}

export function currentLeg(mission) {
  return CONFIG.legs[mission.legIndex];
}

export function nextRing(mission) {
  const leg = currentLeg(mission);
  if (!leg || mission.ringIndex >= leg.rings.length) return null;
  return leg.rings[mission.ringIndex];
}

export function startLeg(mission, now) {
  mission.legStartTime = now;
  mission.ringIndex = 0;
  mission.state = 'flying';
  const leg = currentLeg(mission);
  mission.message = leg.brief;
  mission.messageUntil = now + 5;
}

function announce(mission, text, now, seconds) {
  mission.message = text;
  mission.messageUntil = now + (seconds || 4);
  mission.lastEvent = text;
}

// Call once a frame with the live plane. Returns nothing; mission mutates.
export function stepMission(mission, plane, now, dt) {
  if (mission.state === 'complete' || mission.state === 'crashed') return;
  mission.totalTime += dt;

  if (plane.crashed) {
    mission.state = 'crashed';
    mission.score = Math.max(0, mission.score - CONFIG.score.crashPenalty);
    announce(mission, 'CRASHED — the courier is down. Press R to try again.', now, 8);
    return;
  }

  const leg = currentLeg(mission);
  if (!leg) return;

  // Ring check: inside the ring's sphere while crossing its plane.
  const ring = nextRing(mission);
  if (ring && mission.state === 'flying') {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.altFt * FT_TO_M;
    const dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.r) {
      mission.ringIndex += 1;
      mission.ringsHit += 1;
      mission.score += CONFIG.score.ring;
      const left = leg.rings.length - mission.ringIndex;
      announce(
        mission,
        left > 0 ? `Ring! +${CONFIG.score.ring} — ${left} to go` : 'All rings! Now land at ' + CONFIG.strips[leg.to].name,
        now,
        3,
      );
    }
  }

  // Landing check: on the destination strip, slow, on the ground.
  if (mission.state === 'flying' && mission.ringIndex >= leg.rings.length) {
    const dest = CONFIG.strips[leg.to];
    if (plane.onGround && onStrip(plane.x, plane.z, dest) && plane.speedKts < 60) {
      const descent = Math.abs(plane.verticalSpeedFpm);
      const quality = descent < 300 ? 'perfect' : 'good';
      const bonus = quality === 'perfect' ? CONFIG.score.landingPerfect : CONFIG.score.landingGood;
      const legTime = now - mission.legStartTime;
      const timeBonus = Math.max(0, Math.round(240 - legTime) * CONFIG.score.legTimeBonusPerSec);
      mission.score += bonus + timeBonus;
      mission.landings += 1;
      mission.bestLanding = quality;
      if (mission.legIndex + 1 >= CONFIG.legs.length) {
        mission.state = 'complete';
        announce(mission, `ROUTE COMPLETE! Final score ${mission.score}. Press R to fly again.`, now, 10);
      } else {
        mission.legIndex += 1;
        mission.state = 'landed';
        announce(
          mission,
          `${quality === 'perfect' ? 'Perfect' : 'Good'} landing! +${bonus} + ${timeBonus} time bonus. Press Enter for the next leg.`,
          now,
          8,
        );
      }
    }
  }
}

// Heading from the plane to a world point, in degrees 0..360.
export function bearingTo(plane, x, z) {
  const dx = x - plane.x;
  const dz = z - plane.z;
  const deg = (Math.atan2(dx, dz) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function distanceTo(plane, x, z) {
  return Math.hypot(x - plane.x, z - plane.z);
}

export function altitudeFt(plane) {
  return Math.max(0, Math.round(plane.y * M_TO_FT));
}
