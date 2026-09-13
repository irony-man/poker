import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Court Piece',
  robots: { index: false, follow: false },
};

export default function CourtpiecePlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
