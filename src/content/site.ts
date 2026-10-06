export const site = {
  name: 'Rohith A',
  handle: 'alpharnog',
  tagline: 'LEMME SLACK OFF I DONT WANNA WORK',
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
    bio: "I'm a computer science student in Bangalore and a creative technologist: I design, build and ship across UI, frontend and full-stack systems. Im into all the cool stuffs that exist,rn i wanna build a game but PERHAPS i do not have much knowledge about it so yea Learnin bout stuffs. I'm pulled toward anything where engineering and aesthetics have to be solved at the same time^_^",
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
 * Contact rows on the singularity screen. A null value renders a [TODO]
 * marker in dev and is omitted in production. (No LinkedIn or résumé, by
 * choice; add a row here if that changes.)
 */
export const contact: readonly { label: string; kind: 'email' | 'url' | 'file'; value: string | null }[] = [
  { label: 'Email', kind: 'email', value: 'alph4nog@gmail.com' },
  { label: 'GitHub', kind: 'url', value: 'https://github.com/knsorrigle' },
];
