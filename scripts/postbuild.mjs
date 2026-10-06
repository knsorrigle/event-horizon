// Post-build: per-page HTML, load performance and SEO.
//  - The app is a client-rendered SPA, but link-preview crawlers don't run JS,
//    so every case study gets a real HTML file with its own title,
//    description, canonical and Open Graph tags. Also writes sitemap.xml,
//    robots.txt and llms.txt.
//  - The stylesheet (~6 KB gzipped) is inlined: one fewer render-blocking
//    round trip.
//  - The home page gets the hero prerendered into #root (from the SSR build of
//    src/prerender.tsx), so the LCP element paints before any JS runs.
//
// Absolute URLs need the site's origin: SITE_URL, or Vercel's
// VERCEL_PROJECT_PRODUCTION_URL. Without either, URLs stay relative and the
// sitemap is skipped (a sitemap must be absolute). No domain is ever guessed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Node ≥ 22.18 / 23.6 strips TypeScript types natively; projects.ts is erasable.
import { projects } from '../src/content/projects.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const rawOrigin = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const origin = rawOrigin.replace(/\/$/, '');
if (!origin) console.warn('postbuild: no SITE_URL / VERCEL_PROJECT_PRODUCTION_URL; canonical/og URLs stay relative, sitemap skipped');

const abs = (path) => (origin ? `${origin}${path}` : path);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let template = readFileSync(join(dist, 'index.html'), 'utf8');

// Inline the stylesheet.
const cssLink = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/;
const cssMatch = template.match(cssLink);
if (cssMatch) {
  const css = readFileSync(join(dist, cssMatch[1]), 'utf8');
  template = template.replace(cssLink, () => `<style>${css}</style>`);
}

// The hero, rendered by the same component the client uses.
const { renderHero } = await import(pathToFileURL(join(root, 'dist-ssr', 'prerender.js')).href);
const heroHtml = renderHero();

/**
 * Set a meta/link tag's value, inserting the tag before </head> if absent.
 * (The canonical <link> can't live in index.html: Vite would try to bundle
 * its href as an asset.)
 */
function setTag(html, selectorAttr, selectorValue, attr, value) {
  const re = new RegExp(`(<(?:meta|link)[^>]*${selectorAttr}="${selectorValue}"[^>]*${attr}=")[^"]*(")`);
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$2`);
  const tag = selectorAttr === 'rel' ? 'link' : 'meta';
  return html.replace('</head>', `  <${tag} ${selectorAttr}="${selectorValue}" ${attr}="${esc(value)}" />\n  </head>`);
}

function page({ path, title, description, body = '' }) {
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  if (body) html = html.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
  html = setTag(html, 'name', 'description', 'content', description);
  html = setTag(html, 'property', 'og:title', 'content', title);
  html = setTag(html, 'property', 'og:description', 'content', description);
  html = setTag(html, 'property', 'og:image', 'content', abs('/og.jpg'));
  html = setTag(html, 'name', 'twitter:image', 'content', abs('/og.jpg'));
  // A relative canonical / og:url is invalid: only emit them with a real origin.
  if (origin) {
    html = setTag(html, 'property', 'og:url', 'content', abs(path));
    html = setTag(html, 'rel', 'canonical', 'href', abs(path));
  }
  return html;
}

const home = {
  path: '/',
  title: 'Rohith A · Event Horizon',
  description: 'Rohith A (alpharnog): portfolio. Tools, simulations and light, built close to the edge.',
};
writeFileSync(join(dist, 'index.html'), page({ ...home, body: heroHtml }));
// The SPA fallback for any other URL (see vercel.json): same shell, no
// prerendered home hero, so an unknown path never flashes the wrong page.
writeFileSync(join(dist, 'app.html'), page({ ...home, path: '/' }));

for (const p of projects) {
  const path = `/work/${p.slug}`;
  const dir = join(dist, 'work', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page({ path, title: `${p.name} · Rohith A`, description: p.oneLiner }));
}

const robots = ['User-agent: *', 'Allow: /'];
if (origin) {
  const urls = ['/', ...projects.map((p) => `/work/${p.slug}`)];
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${abs(u)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  writeFileSync(join(dist, 'sitemap.xml'), sitemap);
  robots.push(`Sitemap: ${abs('/sitemap.xml')}`);
}
writeFileSync(join(dist, 'robots.txt'), robots.join('\n') + '\n');

// llms.txt: a plain-text map of the site for language-model agents.
const llms = [
  `# ${home.title}`,
  '',
  `> ${home.description}`,
  '',
  'A portfolio rendered as a raymarched Schwarzschild black hole; every project is a body orbiting in its accretion disk.',
  '',
  '## Projects',
  '',
  ...projects.map((p) => `- [${p.name}](${abs(`/work/${p.slug}`)}): ${p.oneLiner}`),
  '',
];
writeFileSync(join(dist, 'llms.txt'), llms.join('\n'));

console.log(`postbuild: wrote ${projects.length} case-study pages${origin ? ', sitemap.xml' : ''}, robots.txt, llms.txt`);
