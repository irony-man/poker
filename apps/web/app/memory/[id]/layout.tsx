import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Memory Match',
  robots: { index: false, follow: false },
};

export default function MemoryPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
