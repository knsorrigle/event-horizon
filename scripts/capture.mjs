// Re-render the OG image and the static-fallback stills from the live site,
// e.g. after changing the tagline or the look.
//
//   npm run build && npm run preview      # in one terminal
//   npm run capture                       # in another (optionally pass a base URL)
//
// Uses Playwright's CLI on demand (npx, not a project dependency) driving the
// installed Google Chrome. ?capture=… makes the page render the scene even on
// a software rasteriser, with quality pinned and no intro (see capability.ts).
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

const base = (process.argv[2] ?? 'http://127.0.0.1:4173').replace(/\/$/, '');

const shots = [
  { query: 'capture=og', size: '1200,630', out: 'public/og.jpg' },
  { query: 'capture=still', size: '1920,1080', out: 'public/fallback/hole.jpg' },
  { query: 'capture=still', size: '1080,1920', out: 'public/fallback/hole-portrait.jpg' },
];

for (const shot of shots) {
  const url = `${base}/?${shot.query}`;
  console.log(`capture: ${url} @ ${shot.size} → ${shot.out}`);
  const res = spawnSync(
    'npx',
    ['-y', 'playwright@1', 'screenshot', '--channel', 'chrome', '--viewport-size', shot.size, '--wait-for-timeout', '8000', url, shot.out],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    console.error('capture: failed. Is the preview running, and is Google Chrome installed?');
    process.exit(res.status ?? 1);
  }
  console.log(`         ${(statSync(shot.out).size / 1024).toFixed(0)} KB`);
}
