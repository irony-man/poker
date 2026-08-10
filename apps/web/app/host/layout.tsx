import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Host a private table';
const description =
  "Host a private No-Limit Texas Hold'em table for friends. Set seats and stakes, share a link, and start dealing on pokr.site.";
const path = '/host';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function HostLayout({ children }: { children: React.ReactNode }) {
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
