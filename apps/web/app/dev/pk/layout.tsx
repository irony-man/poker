import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Poker components',
  robots: { index: false, follow: false },
};

export default function DevPkLayout({ children }: { children: ReactNode }) {
  return children;
}
