// Generates a tileable 128×128 blue-noise threshold map with Ulichney's
// void-and-cluster algorithm. Output: public/noise/bluenoise128.bin (R8, row-major).
//
// The energy kernel is a toroidal Gaussian. It is separable, so adding or
// removing a point updates the whole energy field in O(N²) multiplies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 128;
const SIZE = N * N;
const SIGMA = 1.5;
const INITIAL_DENSITY = 0.1;

// Deterministic PRNG (mulberry32) so the texture is reproducible.
let seed = 0x9e3779b9;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const g = new Float64Array(N);
for (let d = 0; d < N; d++) {
  const w = Math.min(d, N - d);
  g[d] = Math.exp(-(w * w) / (2 * SIGMA * SIGMA));
}

function splat(energy, idx, sign) {
  const px = idx % N;
  const py = (idx / N) | 0;
  for (let y = 0; y < N; y++) {
    const gy = sign * g[(y - py + N) % N];
    const row = y * N;
    for (let x = 0; x < N; x++) energy[row + x] += gy * g[(x - px + N) % N];
  }
}

function extreme(energy, bits, wantBit, findMax) {
  let best = -1;
  let bestE = findMax ? -Infinity : Infinity;
  for (let i = 0; i < SIZE; i++) {
    if (bits[i] !== wantBit) continue;
    const e = energy[i];
    if (findMax ? e > bestE : e < bestE) {
      bestE = e;
      best = i;
    }
  }
  return best;
}

// 1. Random initial binary pattern, relaxed into a blue-noise prototype.
const proto = new Uint8Array(SIZE);
const protoE = new Float64Array(SIZE);
let ones = 0;
while (ones < SIZE * INITIAL_DENSITY) {
  const i = (rand() * SIZE) | 0;
  if (proto[i]) continue;
  proto[i] = 1;
  splat(protoE, i, 1);
  ones++;
}
for (;;) {
  const cluster = extreme(protoE, proto, 1, true);
  proto[cluster] = 0;
  splat(protoE, cluster, -1);
  const voidIdx = extreme(protoE, proto, 0, false);
  proto[voidIdx] = 1;
  splat(protoE, voidIdx, 1);
  if (voidIdx === cluster) break;
}

const rank = new Uint32Array(SIZE);

// 2. Phase 1: rank the prototype's points by removing tightest clusters.
{
  const bits = proto.slice();
  const energy = protoE.slice();
  for (let r = ones - 1; r >= 0; r--) {
    const c = extreme(energy, bits, 1, true);
    bits[c] = 0;
    splat(energy, c, -1);
    rank[c] = r;
  }
}

// 3. Phases 2+3: fill largest voids until every pixel is ranked. (The tightest
//    cluster of zeros is exactly the largest void of ones, so one loop suffices.)
{
  const bits = proto.slice();
  const energy = protoE.slice();
  for (let r = ones; r < SIZE; r++) {
    const v = extreme(energy, bits, 0, false);
    bits[v] = 1;
    splat(energy, v, 1);
    rank[v] = r;
  }
}

const out = new Uint8Array(SIZE);
for (let i = 0; i < SIZE; i++) out[i] = Math.floor((rank[i] * 256) / SIZE);

const file = join(dirname(fileURLToPath(import.meta.url)), '../public/noise/bluenoise128.bin');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, out);
console.log(`blue noise: wrote ${file} (${N}×${N})`);
