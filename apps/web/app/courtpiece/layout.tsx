import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host Court Piece';
const description =
  'A POKR side quest: host Court Piece with Classic, Classic Full, or Hokm rules. Partnerships, trump, no stakes.';
const path = '/courtpiece';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function CourtpieceLayout({ children }: { children: React.ReactNode }) {
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
