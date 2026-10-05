import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { fetchLegalDocs } from '@/lib/legal';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Privacy Policy';
const description =
  'How pokr.site collects, uses, and protects your information when you play free poker and arcade games.';
const path = '/privacy';

export const revalidate = 300;

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default async function PrivacyPage() {
  const docs = await fetchLegalDocs();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd({ path, name: title, description })),
        }}
      />
      <LegalDocument docKey="privacy" doc={docs.privacy} />
    </>
  );
}
