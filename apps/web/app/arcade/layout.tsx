import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Arcade';
const description =
  'POKR side quests: Ludo, Snakes & Ladders, and Memory Match. No stakes — just boards and friends.';
const path = '/arcade';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function ArcadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd({ path, name: title, description })),
        }}
      />
      {children}
    </>
  );
}
