import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friends',
  robots: { index: false, follow: false },
};

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
