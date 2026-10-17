import { imageAssetUrl } from '@/lib/assets';
import type { HomeLandingFeature } from '@/lib/api';

/** Defaults match original static HomeLanding blocks (used until /api/site loads). */
export const DEFAULT_HOME_FEATURES: HomeLandingFeature[] = [
  {
    title: 'Play Contests',
    body: "Knockout tables where you play until your stack is gone, and fixed-hand games where you choose how many deals run before anyone looks at a card. Everyone buys in for the same stack and the winner takes the whole pot.",
    cta: 'Browse Contests',
    href: '/contests',
    image: imageAssetUrl('home-knockout.webp'),
    imageAlt: 'Stylish player holding pocket cards at a green felt table',
    imageFirst: true,
  },
  {
    title: 'Open Tables',
    body: "Hold'em that runs the way a home game does, no set number of hands and no cap on buy-ins, so you can add chips whenever your stack runs low and leave when the night feels done.",
    cta: 'Join a Table',
    href: '/play?mode=join',
    image: imageAssetUrl('poker-chip-shuffle.svg'),
    imageAlt: 'POKR chips stacking for a fixed-round session',
    imageFirst: false,
  },
  {
    title: 'Community and Social',
    body: 'Add friends by username, gather them into groups for the different circles you play with, and pull a group straight to a table when it is time to deal.',
    cta: 'Play with Friends',
    href: '/friends',
    image: imageAssetUrl('home-host.webp'),
    imageAlt: 'Gloved hand holding a branded chip token',
    imageFirst: true,
  },
  {
    title: 'Challenge 1v1',
    body: 'When you only want one opponent, open your friends list, choose the person, and send a challenge that leaves the table to the two of you and the board between you.',
    cta: 'Challenge a Friend',
    href: '/friends',
    image: imageAssetUrl('home-challenge.webp'),
    imageAlt: 'Two players in a heads-up challenge',
    imageFirst: false,
  },
  {
    title: 'Offline arena',
    body: "Play Hold'em against bots with no connection. Practice lines and timing offline, then jump into live modes when you're ready.",
    cta: 'Offline',
    href: '/solo',
    image: imageAssetUrl('home-offline.webp'),
    imageAlt: 'Stack of red and white chips',
    imageFirst: true,
  },
  {
    title: 'Chat with Bots',
    body: 'Talk to BanterBot for sharp roasts — no table required.',
    cta: 'Open Chat',
    href: '/chat',
    image: imageAssetUrl('home-offline.webp'),
    imageAlt: 'Chat with BanterBot',
    imageFirst: false,
  },
];
