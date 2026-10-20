import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hand analysis',
  robots: { index: false, follow: false },
};

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
