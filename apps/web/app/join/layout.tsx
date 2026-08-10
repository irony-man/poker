import type { Metadata } from 'next';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Join a Table';
const description =
  "Join a Texas Hold'em table with an invite code or shared link. Sit down and play free on pokr.site.";
const path = '/join';

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default function JoinLayout({ children }: { children: React.ReactNode }) {
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
