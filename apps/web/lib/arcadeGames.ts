export const ARCADE_GAMES = [
  {
    id: 'ludo',
    title: 'Ludo',
    blurb: 'Race four tokens home with friends or bots. Classic board, no stakes.',
    href: '/ludo',
  },
  {
    id: 'snakes',
    title: 'Snakes & Ladders',
    blurb: 'Climb ladders, dodge snakes, and be first to 100. Dice and luck.',
    href: '/snakes',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    blurb: 'Flip cards, find pairs, and outscore the table on a 4×4 or 6×6 grid.',
    href: '/memory',
  },
] as const;

export type ArcadeGameId = (typeof ARCADE_GAMES)[number]['id'];
