// The six projects. All copy and facts are Rohith's own; nothing here is
// invented (no links, metrics, claims or years). Fields left null are hidden
// in production.

/** How a body looks in the shader (no colour: pattern, brightness, grain). */
export type BodySurface = 'banded' | 'cellular' | 'filament' | 'vortex' | 'crescent' | 'waves';

export interface MediaItem {
  kind: 'image' | 'video';
  /** Path under /public or an absolute URL. Rendered greyscale: the site has no hue. */
  src: string;
  alt: string;
  caption: string;
  /** Intrinsic size, so the frame reserves space before the media loads. */
  width: number;
  height: number;
  /** Optional poster for video. */
  poster?: string;
}

export interface CaseStudy {
  /** What you did on it. null hides the field. */
  role: string | null;
  /** The problem, in a few sentences. null hides the chapter. */
  problem: string | null;
  /** The hard part you solved. null hides the chapter. */
  hardPart: string | null;
  /** What came of it. Real outcomes only; null hides the chapter. */
  result: string | null;
  /** Screenshots / video / GIFs. Empty: "no signal" plates in dev, hidden in production. */
  media: readonly MediaItem[];
  /** Repo / live / write-up links. Never invented. */
  links: readonly { label: string; href: string }[];
}

export interface Project {
  slug: string;
  name: string;
  /** One line, shown in the hover annotation. */
  oneLiner: string;
  /** Stack tags. Tags starting with "TODO" show in dev only. */
  stack: readonly string[];
  /** Year; null renders as an em dash. */
  year: number | null;
  /** Short poetic labels that ride the orbit rings on hover. */
  orbitLabels: readonly string[];
  caseStudy: CaseStudy;
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
    stack: ['TypeScript', 'Node 20+', 'ESM', 'commander', 'octokit', 'semver', 'zod', 'vitest', 'tsup'],
    year: 2026,
    orbitLabels: ['every error has a past', 'already fixed, somewhere upstream', 'which release'],
    caseStudy: {
      role: 'Solo',
      problem: 'You hit an error, google it, and land on a GitHub issue closed eight months ago. Was it fixed? In which version? Do you have that version? Answering that by hand means digging through issues, PRs, commits and changelogs.',
      hardPart: "Matching a raw pasted error to the right closed issue using GitHub's semantic search, then tracing issue → fixing PR → commit → the first release that contains it, and comparing that against the version actually in your lockfile.",
      result: null,
      media: [],
      links: [{ label: 'Repository', href: 'https://github.com/knsorrigle/fixedin' }],
    },
    body: { surface: 'cellular', orbitRadius: 5.2, inclinationDeg: 16, nodeDeg: 20, phaseDeg: 30, radius: 0.42, brightness: 1.0 },
  },
  {
    slug: 'metalshade',
    name: 'metalshade',
    oneLiner: 'Open-source ReShade alternative for macOS: Swift + Metal post-processing.',
    stack: ['Swift', 'Metal'],
    year: 2026,
    orbitLabels: ['every frame, once more, in light', 'a pass after the last pass', 'metal under glass'],
    caseStudy: {
      role: 'Solo',
      problem: "ReShade lets PC players restyle games with post-processing shaders. On macOS, native Metal games like Cyberpunk 2077's Mac port have no equivalent.",
      hardPart: null,
      result: "Working on Cyberpunk 2077's native Mac port; colour and screen-space effects run, with depth-based effects and fog still in progress.",
      media: [],
      links: [{ label: 'Repository', href: 'https://github.com/knsorrigle/shade-' }],
    },
    body: { surface: 'banded', orbitRadius: 6.6, inclinationDeg: -11, nodeDeg: 75, phaseDeg: 140, radius: 0.5, brightness: 1.15 },
  },
  {
    slug: 'fly-connectome',
    name: 'fly-connectome',
    oneLiner: 'Spiking-network simulations of a Drosophila brain connectome.',
    stack: ['spiking networks', 'connectomics'],
    year: 2026,
    orbitLabels: ['a hundred thousand small fires', 'wired exactly as it was found', 'the fly thinks'],
    caseStudy: {
      role: 'Solo',
      problem: "A fruit fly's brain has been mapped neuron by neuron. What happens if you actually run it?",
      hardPart: 'Turning a connectome graph into a running spiking neural network, moving from connectome-shaped synthetic wiring to the real MaleCNS v1.0 graph pulled from neuPrint.',
      result: null,
      media: [],
      links: [],
    },
    body: { surface: 'filament', orbitRadius: 7.9, inclinationDeg: 21, nodeDeg: 160, phaseDeg: 250, radius: 0.48, brightness: 0.95 },
  },
  {
    slug: 'black-hole-render',
    name: 'black-hole-render',
    oneLiner: 'A realistic black hole rendered in Blender, with scene automation. The origin of this site.',
    stack: ['Blender (Cycles)', 'Python'],
    year: 2026,
    orbitLabels: ['where this began', 'a smaller dark inside the dark', 'rendered, then fallen into'],
    caseStudy: {
      role: 'Solo',
      problem: null,
      hardPart: null,
      result: null,
      media: [],
      links: [],
    },
    body: { surface: 'vortex', orbitRadius: 9.0, inclinationDeg: -18, nodeDeg: 230, phaseDeg: 345, radius: 0.55, brightness: 1.05 },
  },
  {
    slug: 'align',
    name: 'align',
    oneLiner: 'A proximity-based, intentional dating app.',
    stack: ['React Native', 'Expo', 'Convex', 'Clerk', 'NativeWind', 'Groq Whisper'],
    year: 2026,
    orbitLabels: ['two orbits, briefly closer', 'nearness, on purpose', 'conjunction'],
    caseStudy: {
      role: 'Solo: design, app, backend, everything',
      problem: 'Dating apps reward endless swiping, so low-effort matches drown out real intent.',
      hardPart: 'Designing AlignPoints, an effort-signal system that makes reaching out cost something. APs stack over time and the receiver sees the count, so sustained interest becomes visible, while guarding against it turning pay-to-win. Plus a photo upload pipeline rewrite onto Convex storage and voice notes transcribed with Groq Whisper.',
      result: 'In closed testing with ~6–7 users in Bangalore.',
      media: [],
      links: [],
    },
    body: { surface: 'crescent', orbitRadius: 10.2, inclinationDeg: 9, nodeDeg: 300, phaseDeg: 95, radius: 0.46, brightness: 1.0 },
  },
  {
    slug: 'earth-jukebox',
    name: 'earth-jukebox',
    oneLiner: 'NASA Space Apps: sonifying Earth data.',
    stack: ['React', 'TypeScript', 'Tone.js', 'react-three-fiber', 'NASA GIBS'],
    year: 2026,
    orbitLabels: ['the planet, played back', 'data you can hear', 'a pale blue chord'],
    caseStudy: {
      role: 'Built the entire product solo (team entry, NASA Space Apps)',
      problem: "NASA Space Apps challenge: turn NASA's Earth Information Center visuals into sound, so data you'd normally look at can be heard.",
      hardPart: "Making the sound carry real data, not vibes. Inverting NASA's official colormaps to recover true values from the map tiles (not pixel brightness), then mapping them to sound: value → pitch, longitude → stereo pan, latitude → register, against a fixed baseline drone so you hear the deviation grow.",
      result: null,
      media: [],
      links: [],
    },
    body: { surface: 'waves', orbitRadius: 11.2, inclinationDeg: -6, nodeDeg: 10, phaseDeg: 200, radius: 0.52, brightness: 1.1 },
  },
];

export const MAX_BODIES = 6;

/** Stack tags to show: TODO placeholders are visible in dev, never in production. */
export function visibleStack(p: Project): readonly string[] {
  return import.meta.env.DEV ? p.stack : p.stack.filter((tag) => !tag.startsWith('TODO'));
}

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
