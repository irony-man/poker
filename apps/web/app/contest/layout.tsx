import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contest',
  robots: { index: false, follow: false },
};

export default function ContestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
