import { HomeLanding } from '@/components/HomeLanding';
import { homeJsonLd } from '@/lib/site';

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }}
      />
      <HomeLanding />
    </>
  );
}
