import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Snakes & Ladders',
  robots: { index: false, follow: false },
};

export default function SnakesPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
