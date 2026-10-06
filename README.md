# Event Horizon

The portfolio of **Rohith A** (alpharnog), built as a single idea: the
whole site is a real-time black hole. Scrolling is a fall toward the event horizon. The projects
are bodies orbiting in the accretion disk, lensed by the same spacetime as everything else. Past
the horizon, the singularity holds the contact details.

**Live:** https://event-horizon-green.vercel.app

It's strictly monochrome (one cold grey ramp, no hue anywhere) and rendered as a stippled print
rather than smooth CG: blue-noise grain in the falloffs, soft glowing cores.

## The journey

| Scroll | Camera | Chapter |
|---|---|---|
| 0–15% | 40 Rₛ, just above the disk plane | **I · Approach**: name, tagline, live HUD |
| 15–57% | spirals 33 → 15 Rₛ, orbiting ~150° | **II · The Disk**: the six project bodies |
| 57–78% | 15 → 6 Rₛ, tilting to near edge-on | **III · Accretion**: about |
| 78–100% | plunge past the photon ring, across the horizon | **IV · The Fall**: readouts diverge to ∞ |
| end | held at r = 1 in the dark | **V · Singularity**: contact |

- **Hover** a body (or Tab to it) to see its rings and card; **click** (Enter, or tap twice on
  touch) to slingshot to its case study. **← Back to orbit** flies the arc in reverse and lands
  on the exact scroll position and camera pose you left from.
- **Keep scrolling past the end** for the easter egg: a white hole spits you back out, replaying
  the fall in reverse.
- `?debug` shows fps, the adaptive-quality rung, resolution and step count (works in production).
- `?fallback` forces the static fallback; `?capture=og|still` is used by `npm run capture`.

## Physics, and the approximations

Units: Schwarzschild radius **Rₛ = 1** (so M = ½; photon sphere r = 1.5; ISCO r = 3). Everything
is traced per pixel in a fragment shader on a fullscreen triangle (`src/shaders/blackhole.frag`).

**What's modelled**
- **Null geodesics** via the standard "Newtonian photon" trick: a particle under
  a = −1.5 h² x / r⁵ (h = |x × v|, conserved) traces exactly the Schwarzschild photon orbit shape
  u″ + u = 1.5 u². Integrated with kick-drift-kick leapfrog and a step size proportional to r
  (long strides far away, short ones near the photon sphere).
- **Finite-distance observer.** The camera is a static observer at radius r₀. The local ray
  direction's radial component is squashed by the lapse √(1 − 1/r₀) before integration, which makes
  the initial du/dφ match the exact geodesic, so lensing stays correct as the camera falls in.
  Static observers see incoming light blueshifted by 1/lapse, so the sky and disk brighten as you
  fall.
- **Thin accretion disk** from the ISCO to 12 Rₛ. Radial emission follows a Novikov–Thorne-like
  flux F ∝ (1 − √(r_in/r)) / r³. Turbulence is domain-warped periodic FBM rotating at the Keplerian
  rate, with a flow-map cross-fade so the differential rotation never winds the pattern up forever.
- **Redshift and beaming** use the exact factor for an emitter on a circular orbit seen from far
  away: g = √(1 − 3M/r) / (1 − Ωλ), where λ = L_z/E of the photon. The numerator is gravitational
  redshift plus transverse time dilation (it dims the inner edge); the denominator is Doppler (the
  approaching side brightens). Intensity scales as g³, the specific intensity for a flat spectrum
  (I_ν/ν³ is invariant). g⁴ (bolometric) is also physical but hides the receding side; the
  exponent is tunable.
- **Photon ring and Einstein ring** emerge on their own: the photon ring from rays that orbit
  more than once, the Einstein ring from a faint cloud placed directly behind the hole.
- **Project bodies** are emissive spheres hit by the *same bent rays* (chord–sphere tests per
  step), so they lens and show secondary images. Their orbits are circular, inclined and Keplerian
  (Ω = √(M/a³)), on the same clock as the disk. A sphere-tracing-style safe distance skips sphere
  tests until a ray could actually reach one (exact, not approximate).
- **HUD readouts** are closed-form, for a static observer at the camera radius:
  time dilation 1/√(1 − 1/r), static redshift z = 1/√(1 − 1/r) − 1, and each body's orbital speed
  v = 1/√(2(r − 1)) c.

**What's not modelled** (deliberately, for the frame budget or the look)
- Black-hole spin (no Kerr metric, no frame dragging).
- Disk thickness, self-shadowing and radiative transfer: the disk is a semi-transparent sheet.
- The observer's own motion: the camera is always a *static* observer, so there's no
  orbital-velocity aberration on the camera, even during the slingshot.
- Light-travel-time delays, and the bodies' own gravity.
- Inside the horizon: the camera stops at r = 1 and the scene fades out. Nothing past it is rendered.

## Render pipeline

1. **Geodesic raymarch** at 0.5× device pixels into a half-float target, with a second render
   output carrying a body ID per pixel for picking.
2. **Upsample** to the canvas, sampling the target's mip chain when the scene should be defocused
   (case-study reading mode): a near-free blur.
3. **Bloom**: pmndrs `postprocessing`, mipmap (dual-filter) blur.
4. **Stipple** (`src/shaders/stipple.frag`): tone map, then blue-noise ordered dithering driven by
   luminance onto the grey ramp. Coarse cells in shadows, fine cells in highlights, blended back
   toward continuous tone in the cores. The blue noise is generated by `scripts/gen-bluenoise.mjs`
   (void-and-cluster) and re-rolled a few times a second so the grain shimmers.

The canvas renders at CSS resolution and is upscaled with `image-rendering: pixelated`, because
the grain is quantised to CSS pixels anyway. **Picking** reads one pixel back asynchronously
(PBO + fence), throttled, so it never stalls the pipeline. A **JS twin of the integrator**
(`src/engine/lensing.ts`) solves where each body's *lensed* image is on screen, so the SVG rings
and cards attach to what you actually see.

**Performance**
- **Adaptive quality:** a rolling frame-time window steps resolution and max steps down a
  five-rung ladder on sustained overload, and only probes upward after a long calm.
- **Pausing:** rendering stops while the tab is hidden, and the raymarch is skipped entirely once
  the singularity is black.
- **Static fallback:** no WebGL2, a software rasteriser, missing float targets, Save-Data, or a
  device that can't hold the lowest rung all get a still rendered by this renderer, under the
  same DOM.
- **Measured:** about 59 fps through the whole fall at Retina DPR 2 on an Apple M4. Throttled-phone
  LCP is 0.8 s, because the hero is prerendered into the HTML. Lighthouse accessibility, best
  practices and SEO are all 100.

## Stack (and why each dependency is here)

| Dependency | Why |
|---|---|
| `react`, `react-dom` | DOM layer and routing shell; the hero is also prerendered with `react-dom/server` at build. |
| `three` | WebGL renderer, render targets, async shader compile. Used minimally: one fullscreen triangle. React Three Fiber was skipped; it adds nothing for a single quad. |
| `postprocessing` | Bloom (mipmap blur) and the effect-pass the custom stipple effect plugs into. |
| `gsap` | The single animation loop, ScrollTrigger (scroll → camera uniforms) and SplitText. All DOM animation. |
| `lenis` | Smooth scrolling, driven from GSAP's ticker so there's exactly one RAF loop. |
| `tailwindcss` + `@tailwindcss/vite` (dev) | The DOM layer's styling (v4). |
| `vite-plugin-glsl` (dev) | GLSL in `.frag`/`.vert` files with `#include` chunks, minified in production. |
| `tweakpane` + `@tweakpane/core` (dev) | Live tuning panel for every uniform, dev-only. It's stripped from production builds (`@tweakpane/core` is only its type declarations). |
| `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*` (dev) | Build and strict typing. |

The router is a hand-rolled History API router (two routes) with View Transitions. Fonts are
self-hosted: **Melodrama** (display), **Archivo** (labels), **IBM Plex Mono** (data).

## Run it

Requires Node ≥ 22.18 locally (`engines` pins Vercel to 24.x). The postbuild step imports `projects.ts` using
Node's built-in TypeScript type stripping.

```sh
npm install
npm run dev        # http://localhost:5173 (Tweakpane panel top-right, fps readout top-centre)
npm run build      # typecheck, client build, hero SSR build, postbuild (pages, sitemap, robots, llms.txt)
npm run preview    # serve the production build at http://localhost:4173
npm run capture    # with the preview running: re-render public/og.jpg and the fallback stills
```

`predev` and `prebuild` download **Melodrama** from Fontshare into `public/fonts/melodrama/`.
Its ITF Free Font License allows self-hosting on your own site but forbids redistributing the font
files through a repository, or modifying them. So the files are gitignored and never committed.
Archivo and IBM Plex Mono (OFL) are committed.

`npm run gen:bluenoise` regenerates `public/noise/bluenoise128.bin` (deterministic).

**Tuning:** every shader parameter lives in `src/engine/params.ts`. In dev, Tweakpane binds to it
live, and **copy params as JSON** exports what you've dialled in. The scroll camera path's beats
are in `src/scroll/fall.ts`.

## Deploy

Vercel, connected to this GitHub repo: every push to `main` deploys to production. `vercel.json`
holds the build command, an SPA rewrite to a hero-less `app.html` shell (so unknown URLs don't
flash the home page), immutable caching for hashed assets, and basic security headers.

Absolute URLs (canonical, `og:url`, `og:image`, sitemap) come from `SITE_URL` or, on Vercel, from
`VERCEL_PROJECT_PRODUCTION_URL` automatically. To use a custom domain, add it in Vercel and set
`SITE_URL=https://your.domain` for production builds.

## Add or change a project

Projects live in `src/content/projects.ts`. Each entry has:

- `slug`, `name`, `oneLiner`, `stack`, `year`
- `orbitLabels`: the short lines that ride its rings on hover
- `caseStudy`: `role`, `problem`, `hardPart`, `result`, `media[]` (`kind`, `src`, `alt`,
  `caption`, `width`, `height`, optional `poster`) and `links[]`
- `body`: how it orbits and looks:
  - `surface`: one of `banded`, `cellular`, `filament`, `vortex`, `crescent`, `waves`
  - `orbitRadius`: in Rₛ; keep it within the disk, about 4.5–11.5
  - `inclinationDeg`, `nodeDeg`, `phaseDeg`
  - `radius`: about 0.4–0.6 Rₛ
  - `brightness`

The shader supports **up to six bodies** (`MAX_BODIES`; raising it means editing the uniform
arrays in `blackhole.frag`). The case-study page, prerendered HTML, sitemap, `llms.txt`, hidden
keyboard list and fallback index all generate from this one file.

Missing content is written as `null` / `TODO`. In dev it shows as visible `[TODO: …]` markers; in
production it renders as "—", and empty chapters, plates and contact rows are hidden. Stack tags
starting with `TODO` are filtered out in production.

## Content still to fill in

- [ ] **Tagline**: `src/content/site.ts` → `site.tagline` (currently a placeholder)
- [ ] **Bio**: `src/content/site.ts` → `chapters.accretion.bio`
- [ ] **Contact**: `src/content/site.ts` → `contact` (email, GitHub, LinkedIn, résumé PDF in `/public`)
- [ ] **Each project** in `src/content/projects.ts`:
  - `year`, and the `TODO` stack tags
  - `caseStudy.role`, `problem`, `hardPart`, `result`
  - `media` and `links`
- [ ] Review the drafted copy: verse blocks (`site.ts`), orbit labels (`projects.ts`), the
  singularity headline and note
- [ ] After the tagline changes: `npm run build && npm run preview`, then `npm run capture` to
  re-render the OG image and fallback stills, and commit them

## Project layout

```
src/
  shaders/          blackhole.frag (geodesics, disk, bodies, sky), stipple.frag, upsample.frag
  engine/           Engine, BlackHolePass, StippleEffect, quality, lensing (CPU twin), bodies,
                    camera, capability (fallback detection), interaction (hover/focus/lock)
  scroll/           rig (camera state), fall (scroll timeline), chapters, slingshot, whitehole
  components/       Stage, HeroSection, Frame, Readouts, Annotations, Panel, Singularity, …
  routes/           Home, Work (case studies)
  content/          site.ts, projects.ts (all copy and data)
  app/              App, router, meta
  dev/              devtools (Tweakpane; dev only)
scripts/            fetch-fonts, gen-bluenoise, postbuild, capture
```
