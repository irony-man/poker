import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Table',
  robots: { index: false, follow: false },
};

export default function TableLayout({ children }: { children: React.ReactNode }) {
  return children;
}
