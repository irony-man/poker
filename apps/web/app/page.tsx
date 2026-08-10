import type { Metadata } from 'next';
import { HomeLanding } from '@/components/HomeLanding';
import { homeJsonLd, SITE_TITLE_DEFAULT } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }}
      />
      <h1 className="sr-only">{SITE_TITLE_DEFAULT}</h1>
      <HomeLanding />
    </>
  );
}
