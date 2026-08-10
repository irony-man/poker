import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Contests & tournaments';
const description =
  "Enter Knockout freezeouts and fixed-round Texas Hold'em contests. Free competitive play on pokr.site.";
const path = '/contests';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function ContestsLayout({ children }: { children: React.ReactNode }) {
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
