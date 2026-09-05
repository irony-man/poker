import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host a Ludo board';
const description =
  'A POKR side quest: host a 2–4 player Ludo board with optional bots and a shareable code. No stakes.';
const path = '/ludo';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function LudoLayout({ children }: { children: React.ReactNode }) {
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
