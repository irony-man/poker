export type AdminTab =
  | 'users'
  | 'content'
  | 'home'
  | 'pages'
  | 'bots'
  | 'economy'
  | 'sounds'
  | 'games';

export const ADMIN_TABS: AdminTab[] = [
  'users',
  'content',
  'home',
  'pages',
  'bots',
  'economy',
  'sounds',
  'games',
];

export const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Banner' },
  { id: 'home', label: 'Home page' },
  { id: 'pages', label: 'Pages' },
  { id: 'bots', label: 'Bot groups' },
  { id: 'economy', label: 'Economy' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'games', label: 'Live games' },
];

export function parseAdminTab(raw: string | null): AdminTab {
  if (raw && (ADMIN_TABS as string[]).includes(raw)) return raw as AdminTab;
  return 'users';
}

export const MAX_HOME_BLOCKS = 12;
