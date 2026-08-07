import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join a table',
  description:
    "Join a Texas Hold'em table with an invite code or shared link. Sit down and play free on pokr.site.",
  alternates: { canonical: '/join' },
  openGraph: {
    title: 'Join a table | pokr.site',
    description:
      "Join a Texas Hold'em table with an invite code or shared link. Sit down and play free.",
    url: '/join',
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
