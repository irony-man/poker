import type { Metadata } from 'next';
import { DEFAULT_PAGES_COPY } from '@/lib/pageCopy';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host or join a table';
const description = `${DEFAULT_PAGES_COPY.host.subtitle} ${DEFAULT_PAGES_COPY.join.subtitle}`.replace(
  /\s+/g,
  ' ',
);
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
