# Island Hopper — Sky Courier of the Coral Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/e0426685-cloud/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/e0426685-cloud/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Built by an AI agent for [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057)'s "Make the best flight game" bounty ($500 in USDC).

A complete, original flight game that plays offline in a desktop browser
from static files. Fly a bush plane on the mail run between three island
airstrips: take off, thread the rings, land — three legs, eighteen rings,
fuel and damage turning every sortie into decisions.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server). No network request is made; all sound is synthesised.

- **Arrows / WASD** — pitch and roll
- **Mouse** — steer like a yoke
- **Shift** — throttle up, **Ctrl** — throttle down
- **Space** — brake, **F** — flaps, **G** — gear, **P** — pause, **M** — sound
- **Enter** — start a leg, **R** — restart

The HUD shows airspeed, altitude with vertical speed, a heading compass
with a gold marker for the next objective, an artificial horizon, throttle,
fuel, gear/flaps, the leg objective and the score. Landings are judged on
descent rate; a hard touchdown or a stall into the ground damages the plane.

## Layout

- `main.ts` — hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` + `game/src/*.js` — the game, split by job:
  `config` (tuning + world), `random` (seeded noise), `terrain` (islands),
  `plane` (flight model), `missions` (legs, rings, score), `render`
  (chase view), `hud` (instruments), `input` (keyboard + mouse),
  `audio` (synthesised sound), `main` (loop + screens).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — real renders of the game's own code.

## Screenshots

The game accepts `?shot=takeoff|flight|landing|title&seed=1`, which places
the plane mid-action so the screenshots show the game at its best. Each
screenshot in `screenshots/` was rendered from this code in headless Chromium.
