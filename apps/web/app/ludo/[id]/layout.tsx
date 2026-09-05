import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ludo',
  robots: { index: false, follow: false },
};

export default function LudoPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
