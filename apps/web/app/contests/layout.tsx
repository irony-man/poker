import type { Metadata } from 'next';
import { DEFAULT_PAGES_COPY } from '@/lib/pageCopy';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Contests & tournaments';
const description = DEFAULT_PAGES_COPY.contests.subtitle;
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
