// The six projects. Only facts from the brief are filled in; everything else
// is an explicit TODO for Rohith. Nothing here is invented: no links, metrics,
// claims or years.

/** How a body looks in the shader (no colour: pattern, brightness, grain). */
export type BodySurface = 'banded' | 'cellular' | 'filament' | 'vortex' | 'crescent' | 'waves';

export interface Project {
  slug: string;
  name: string;
  /** One line, shown in the hover annotation. */
  oneLiner: string;
  /** Stack tags; TODO where the brief doesn't say. */
  stack: readonly string[];
  /** TODO(rohith): year; null renders as an em dash. */
  year: number | null;
  /** Short poetic labels that ride the orbit rings on hover. */
  orbitLabels: readonly string[];
  body: {
    surface: BodySurface;
    /** Orbit semi-major axis in Rs, inside the disk's 3–12 Rs span. */
    orbitRadius: number;
    /** Degrees; tilts lift bodies above/below the disk so they read. */
    inclinationDeg: number;
    nodeDeg: number;
    phaseDeg: number;
    /** Sphere radius in Rs. */
    radius: number;
    brightness: number;
  };
}

export const projects: readonly Project[] = [
  {
    slug: 'fixedin',
    name: 'fixedin',
    oneLiner: 'Open-source CLI that tells you if a pasted error was already fixed upstream, and in which release.',
    stack: ['CLI', 'open source', 'TODO: language'],
    year: null,
    orbitLabels: ['every error has a past', 'already fixed, somewhere upstream', 'which release'],
    body: { surface: 'cellular', orbitRadius: 5.2, inclinationDeg: 16, nodeDeg: 20, phaseDeg: 30, radius: 0.42, brightness: 1.0 },
  },
  {
    slug: 'metalshade',
    name: 'metalshade',
    oneLiner: 'Open-source ReShade alternative for macOS: Swift + Metal post-processing.',
    stack: ['Swift', 'Metal', 'macOS', 'open source'],
    year: null,
    orbitLabels: ['every frame, once more, in light', 'a pass after the last pass', 'metal under glass'],
    body: { surface: 'banded', orbitRadius: 6.6, inclinationDeg: -11, nodeDeg: 75, phaseDeg: 140, radius: 0.5, brightness: 1.15 },
  },
  {
    slug: 'fly-connectome',
    name: 'fly-connectome',
    oneLiner: 'Spiking-network simulations of a Drosophila brain connectome.',
    stack: ['spiking networks', 'connectomics', 'TODO: language / simulator'],
    year: null,
    orbitLabels: ['a hundred thousand small fires', 'wired exactly as it was found', 'the fly thinks'],
    body: { surface: 'filament', orbitRadius: 7.9, inclinationDeg: 21, nodeDeg: 160, phaseDeg: 250, radius: 0.48, brightness: 0.95 },
  },
  {
    slug: 'black-hole-render',
    name: 'black-hole-render',
    oneLiner: 'A realistic black hole rendered in Blender, with scene automation. The origin of this site.',
    stack: ['Blender', 'scene automation', 'TODO: tooling'],
    year: null,
    orbitLabels: ['where this began', 'a smaller dark inside the dark', 'rendered, then fallen into'],
    body: { surface: 'vortex', orbitRadius: 9.0, inclinationDeg: -18, nodeDeg: 230, phaseDeg: 345, radius: 0.55, brightness: 1.05 },
  },
  {
    slug: 'align',
    name: 'align',
    oneLiner: 'A proximity-based, intentional dating app.',
    stack: ['React Native', 'Expo'],
    year: null,
    orbitLabels: ['two orbits, briefly closer', 'nearness, on purpose', 'conjunction'],
    body: { surface: 'crescent', orbitRadius: 10.2, inclinationDeg: 9, nodeDeg: 300, phaseDeg: 95, radius: 0.46, brightness: 1.0 },
  },
  {
    slug: 'earth-jukebox',
    name: 'earth-jukebox',
    oneLiner: 'NASA Space Apps: sonifying Earth data.',
    stack: ['NASA Space Apps', 'sonification', 'TODO: stack'],
    year: null,
    orbitLabels: ['the planet, played back', 'data you can hear', 'a pale blue chord'],
    body: { surface: 'waves', orbitRadius: 11.2, inclinationDeg: -6, nodeDeg: 10, phaseDeg: 200, radius: 0.52, brightness: 1.1 },
  },
];

export const MAX_BODIES = 6;

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
