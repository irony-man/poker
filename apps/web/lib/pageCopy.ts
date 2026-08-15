/** Client-side defaults for lobby page titles/subtitles (matches server DEFAULT_PAGES_COPY). */

export type PageCopyKey =
  | 'host'
  | 'join'
  | 'public'
  | 'contests'
  | 'friends'
  | 'solo'
  | 'signIn'
  | 'signUp'
  | 'homeAuthFooter';

export interface PageCopy {
  title: string;
  subtitle: string;
  /** Lobby split-card illustration. Empty on homeAuthFooter. */
  image?: string;
  imageAlt?: string;
}

export type PagesCopy = Record<PageCopyKey, PageCopy>;

export const PAGE_COPY_KEYS: PageCopyKey[] = [
  'host',
  'join',
  'public',
  'contests',
  'friends',
  'solo',
  'signIn',
  'signUp',
  'homeAuthFooter',
];

export const PAGE_COPY_LABELS: Record<PageCopyKey, string> = {
  host: 'Host',
  join: 'Join',
  public: 'Public tables',
  contests: 'Contests',
  friends: 'Friends',
  solo: 'Offline',
  signIn: 'Sign in',
  signUp: 'Sign up',
  homeAuthFooter: 'Home auth footer',
};

export const PAGE_COPY_PATHS: Record<PageCopyKey, string> = {
  host: '/host',
  join: '/join',
  public: '/public',
  contests: '/contests',
  friends: '/friends',
  solo: '/solo',
  signIn: '/sign-in',
  signUp: '/sign-up',
  homeAuthFooter: '/',
};

export const PAGE_COPY_GROUPS: { label: string; keys: PageCopyKey[] }[] = [
  {
    label: 'Lobby',
    keys: ['host', 'join', 'public', 'contests', 'friends', 'solo'],
  },
  {
    label: 'Account',
    keys: ['signIn', 'signUp', 'homeAuthFooter'],
  },
];

export const DEFAULT_PAGES_COPY: PagesCopy = {
  host: {
    title: 'Create a table',
    subtitle:
      "Set stakes and seats, choose starting bots, and open a private Hold'em room with a code you pick or we generate.",
    image: '/host-table.png',
    imageAlt: 'Host a private table for your group',
  },
  join: {
    title: 'Join a Table',
    subtitle:
      'Enter the invite code you were sent to take a seat or watch the hand, whether it is a private table or a contest.',
    image: '/join-table.png',
    imageAlt: 'Enter a table with an invite code',
  },
  public: {
    title: 'Public tables',
    subtitle:
      "Open Hold'em at the stakes you choose; sit down when a seat is free or spectate if you would rather watch.",
    image: '/public-tables.png',
    imageAlt: 'Open public ring games ready to join',
  },
  contests: {
    title: 'Host Contests',
    subtitle:
      'Host a room for friends in a Knockout freezeout or a fixed run of hands, set the max table size, invite people, and start when the seats look right.',
    image: '/home-knockout.png',
    imageAlt: 'Multi-seat tournament table ready to fill',
  },
  friends: {
    title: 'Community and Social',
    subtitle:
      'Find people by username, build groups for the tables you play together, invite a group to sit down, or challenge a friend to heads-up.',
    image: '/home-host.png',
    imageAlt: 'Invite friends to your table',
  },
  solo: {
    title: 'Offline Arena',
    subtitle:
      "Train against bots on this device with the same Hold'em rules as live tables, no connection or lobby, and a seat count you choose before the first deal.",
    image: '/home-offline.png',
    imageAlt: 'You versus a bot at a private practice table',
  },
  signIn: {
    title: 'Sign in',
    subtitle: 'Sign in with your username',
    image: '/home-challenge.png',
    imageAlt: 'Sit down and sign in to play',
  },
  signUp: {
    title: 'Create account',
    subtitle: 'Create a username and password',
    image: '/home-knockout.png',
    imageAlt: 'Join the table — create your account',
  },
  homeAuthFooter: {
    title: 'Ready to play?',
    subtitle: 'Sign in · Create account',
  },
};

export function clonePagesCopy(pages: PagesCopy = DEFAULT_PAGES_COPY): PagesCopy {
  const out = {} as PagesCopy;
  for (const key of PAGE_COPY_KEYS) {
    out[key] = { ...pages[key] };
  }
  return out;
}
