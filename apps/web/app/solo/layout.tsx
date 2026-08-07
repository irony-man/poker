import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline practice',
  description:
    "Practice Texas Hold'em against bots offline. Learn lines and timing with no connection on pokr.site.",
  alternates: { canonical: '/solo' },
  openGraph: {
    title: 'Offline practice | pokr.site',
    description: "Practice Texas Hold'em against bots offline. Learn lines and timing with no connection.",
    url: '/solo',
  },
};

export default function SoloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
