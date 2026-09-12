import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host or join a table';
const description =
  "Host a private No-Limit Texas Hold'em table or join with an invite code. Play free on pokr.site.";
const path = '/play';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function PlayLayout({ children }: { children: React.ReactNode }) {
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
