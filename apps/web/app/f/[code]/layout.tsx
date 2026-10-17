import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friend invite',
  description: 'You have been invited to be friends on Pokr.',
  robots: { index: false, follow: false },
};

export default function FriendLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
