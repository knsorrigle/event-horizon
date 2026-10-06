// Downloads Melodrama from Fontshare at dev/build time.
//
// The ITF Free Font License allows self-hosting on our own site but forbids
// redistributing the font files through a repository, and forbids modifying
// them (including subsetting / format conversion). So the official woff2 is
// pulled from Fontshare into a gitignored folder instead of being committed.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/fonts/melodrama');
const wanted = {
  'Fonts/WEB/fonts/Melodrama-Variable.woff2': 'Melodrama-Variable.woff2',
  'License/FFL.txt': 'LICENSE-FFL.txt',
};

if (Object.values(wanted).every((f) => existsSync(join(outDir, f)))) process.exit(0);

const res = await fetch('https://api.fontshare.com/v2/fonts/download/melodrama');
if (!res.ok) throw new Error(`Fontshare download failed: ${res.status}`);
const zip = Buffer.from(await res.arrayBuffer());

// Minimal zip reader: walk the central directory, inflate the entries we need.
const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('Not a zip archive');
let p = zip.readUInt32LE(eocd + 16);
const count = zip.readUInt16LE(eocd + 10);
mkdirSync(outDir, { recursive: true });

for (let i = 0; i < count; i++) {
  const method = zip.readUInt16LE(p + 10);
  const compSize = zip.readUInt32LE(p + 20);
  const nameLen = zip.readUInt16LE(p + 28);
  const extraLen = zip.readUInt16LE(p + 30);
  const commentLen = zip.readUInt16LE(p + 32);
  const local = zip.readUInt32LE(p + 42);
  const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
  p += 46 + nameLen + extraLen + commentLen;

  const key = Object.keys(wanted).find((k) => name.endsWith(k));
  if (!key) continue;
  const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const raw = zip.subarray(dataStart, dataStart + compSize);
  writeFileSync(join(outDir, wanted[key]), method === 8 ? inflateRawSync(raw) : raw);
}

for (const f of Object.values(wanted)) {
  if (!existsSync(join(outDir, f))) throw new Error(`Missing ${f} in Fontshare archive`);
}
console.log('fonts: Melodrama fetched from Fontshare');
