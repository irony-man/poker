export type AdminTab =
  | 'users'
  | 'content'
  | 'home'
  | 'pages'
  | 'bots'
  | 'economy'
  | 'sounds'
  | 'games'
  | 'hands';

export const ADMIN_TABS: AdminTab[] = [
  'users',
  'content',
  'home',
  'pages',
  'bots',
  'economy',
  'sounds',
  'games',
  'hands',
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
  { id: 'hands', label: 'Hands' },
];

export const ADMIN_NAV: { label: string; items: { id: AdminTab; label: string }[] }[] = [
  {
    label: 'Players',
    items: [
      { id: 'users', label: 'Users' },
      { id: 'hands', label: 'Hands' },
    ],
  },
  {
    label: 'Site',
    items: [
      { id: 'content', label: 'Banner' },
      { id: 'home', label: 'Home page' },
      { id: 'pages', label: 'Pages' },
      { id: 'sounds', label: 'Sounds' },
    ],
  },
  {
    label: 'Tables',
    items: [
      { id: 'bots', label: 'Bot groups' },
      { id: 'economy', label: 'Economy' },
      { id: 'games', label: 'Live games' },
    ],
  },
];

export function parseAdminTab(raw: string | null): AdminTab {
  if (raw && (ADMIN_TABS as string[]).includes(raw)) return raw as AdminTab;
  return 'users';
}

export function adminTabHref(tab: AdminTab): string {
  return tab === 'users' ? '/admin' : `/admin?tab=${tab}`;
}

export const MAX_HOME_BLOCKS = 12;
