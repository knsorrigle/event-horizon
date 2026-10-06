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
  },
} as const;

export type ChapterId = keyof typeof chapters;
