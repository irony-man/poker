import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host Memory Match';
const description =
  'A POKR side quest: host a Memory Match on a 4×4 or 6×6 grid with friends or bots. No stakes.';
const path = '/memory';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
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
