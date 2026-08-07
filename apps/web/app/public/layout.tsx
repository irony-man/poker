import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Public tables',
  description:
    "Browse open public Texas Hold'em tables and jump into a free game on pokr.site.",
  alternates: { canonical: '/public' },
  openGraph: {
    title: 'Public tables | pokr.site',
    description: "Browse open public Texas Hold'em tables and jump into a free game.",
    url: '/public',
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
