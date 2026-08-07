import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Host a private table',
  description:
    "Host a private No-Limit Texas Hold'em table for friends. Set seats and stakes, share a link, and start dealing on pokr.site.",
  alternates: { canonical: '/host' },
  openGraph: {
    title: 'Host a private table | pokr.site',
    description:
      "Host a private No-Limit Texas Hold'em table for friends. Set seats and stakes, share a link, and start dealing.",
    url: '/host',
  },
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
