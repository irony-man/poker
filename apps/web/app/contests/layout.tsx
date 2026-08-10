import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contests & tournaments',
  description:
    "Enter Knockout freezeouts and fixed-round Texas Hold'em contests. Free competitive play on pokr.site.",
  alternates: { canonical: '/contests' },
  openGraph: {
    title: 'Contests & tournaments | pokr.site',
    description:
      "Enter Knockout freezeouts and fixed-round Texas Hold'em contests. Free competitive play.",
    url: '/contests',
  },
};

export default function ContestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
