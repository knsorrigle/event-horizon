export const site = {
  name: 'Rohith A',
  handle: 'alpharnog',
  // TODO(rohith): placeholder tagline, drafted only to set the layout. Replace with your own line.
  tagline: 'Tools, simulations and light, built close to the edge.',
} as const;

/**
 * Chapter copy for the fall. Verse blocks are short stacked uppercase captions
 * (3–6 lines). Everything here is editable; none of it makes claims about you.
 */
export const chapters = {
  approach: {
    numeral: 'I',
    name: 'Approach',
  },
  disk: {
    numeral: 'II',
    name: 'The Disk',
    title: 'The Disk',
    caption: 'Selected work · six bodies in orbit',
    // An orbit is a fall that keeps missing.
    verse: ['Everything here', 'is still falling,', 'only sideways,', 'fast enough', 'to miss.'],
  },
  accretion: {
    numeral: 'III',
    name: 'Accretion',
    title: 'Accretion',
    caption: 'About',
    // TODO(rohith): your bio / manifesto, 2–4 sentences. Placeholder shown on the page until then.
    bio: '[Bio to be written: two or three sentences on who you are, what you build, and what pulls you in.]',
    verse: ['What falls in', 'heats up.', 'What heats up', 'shines.'],
  },
  fall: {
    numeral: 'IV',
    name: 'The Fall',
    title: 'The Fall',
    // Physically literal: at 1.5 Rs light can orbit; inside 1 Rs every path leads inward.
    verse: ['Past this radius', 'light itself', 'orbits.', 'Past the next,', 'every future', 'points inward.'],
  },
  singularity: {
    numeral: 'V',
    name: 'Singularity',
    headline: 'Send a signal.',
    // Physically: nothing leaves from inside the horizon. Email is the exception we allow.
    note: 'Light can’t get out of here. Email can.',
  },
} as const;

export type ChapterId = keyof typeof chapters;

/**
 * Contact. TODO(rohith): fill every value; nothing here is guessed.
 * null renders a [TODO] marker in dev and is omitted in production.
 */
export const contact: readonly { label: string; kind: 'email' | 'url' | 'file'; value: string | null }[] = [
  { label: 'Email', kind: 'email', value: null }, // TODO(rohith): address
  { label: 'GitHub', kind: 'url', value: null }, // TODO(rohith): profile URL
  { label: 'LinkedIn', kind: 'url', value: null }, // TODO(rohith): profile URL
  { label: 'Résumé', kind: 'file', value: null }, // TODO(rohith): drop the PDF in /public and put its path here
];
