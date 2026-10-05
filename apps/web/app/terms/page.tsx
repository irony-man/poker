import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { fetchLegalDocs } from '@/lib/legal';
import { pageJsonLd, publicPageMetadata } from '@/lib/site';

const title = 'Terms & Conditions';
const description =
  'The rules for using pokr.site: eligibility, play-money chips, fair play, and your account.';
const path = '/terms';

export const revalidate = 300;

export const metadata: Metadata = publicPageMetadata({ title, description, path });

export default async function TermsPage() {
  const docs = await fetchLegalDocs();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd({ path, name: title, description })),
        }}
      />
      <LegalDocument docKey="terms" doc={docs.terms} />
    </>
  );
}
