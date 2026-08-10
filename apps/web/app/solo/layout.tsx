import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Offline practice';
const description =
  "Practice Texas Hold'em against bots offline. Learn lines and timing with no connection on pokr.site.";
const path = '/solo';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function SoloLayout({ children }: { children: React.ReactNode }) {
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
