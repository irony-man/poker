import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Public tables';
const description =
  "Browse open public Texas Hold'em tables and jump into a free game on pokr.site.";
const path = '/public';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
