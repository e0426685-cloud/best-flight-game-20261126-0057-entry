// Headless-Chromium screenshot runner for Island Hopper.
// Expects game/ already served on localhost:8123 (see serve-game.mjs).
// Usage: node shots.mjs — writes screenshots/1-flight.png etc.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shotDir = join(here, 'screenshots');
const port = Number(process.argv[2] || '8123');

const CHROME =
  process.env.CHROME_BIN ||
  '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';

const SHOTS = [
  { name: '1-flight.png', query: '?shot=flight&seed=1', budget: 2500 },
  { name: '2-takeoff.png', query: '?shot=takeoff&seed=1', budget: 2500 },
  { name: '3-landing.png', query: '?shot=landing&seed=1', budget: 2500 },
  { name: '4-title.png', query: '?shot=title&seed=1', budget: 2500 },
];

mkdirSync(shotDir, { recursive: true });
for (const shot of SHOTS) {
  const out = join(shotDir, shot.name);
  const url = `http://127.0.0.1:${port}/index.html${shot.query}`;
  const r = spawnSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1280,887', // headless reserves ~87 px: viewport is 1280x800
      `--virtual-time-budget=${shot.budget}`,
      `--screenshot=${out}`,
      url,
    ],
    { encoding: 'utf8', timeout: 90000 },
  );
  console.log(shot.name, 'exit', r.status, (r.stderr || '').trim().slice(-200));
}
console.log('done');
