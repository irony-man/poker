import Link from 'next/link';
import { LEGAL_DOC_PATHS, type LegalDoc, type LegalDocKey } from '@poker/protocol';
import { parseLegalMarkdown, type LegalInline, type LegalTokenValues } from '@/lib/legalMarkdown';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_JURISDICTION,
  LEGAL_MIN_AGE,
  LEGAL_OPERATOR_NAME,
  SITE_NAME,
} from '@/lib/site';

const TOKEN_VALUES: LegalTokenValues = {
  siteName: SITE_NAME,
  operatorName: LEGAL_OPERATOR_NAME,
  contactEmail: LEGAL_CONTACT_EMAIL,
  jurisdiction: LEGAL_JURISDICTION,
  minAge: String(LEGAL_MIN_AGE),
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function Inlines({ inlines }: { inlines: LegalInline[] }) {
  return (
    <>
      {inlines.map((node, i) => {
        if (node.type === 'bold') {
          return (
            <strong key={i} className="font-semibold text-primary">
              {node.text}
            </strong>
          );
        }
        if (node.type === 'link') {
          return node.href.startsWith('/') ? (
            <Link key={i} href={node.href} className="link-sidebar">
              {node.text}
            </Link>
          ) : (
            <a
              key={i}
              href={node.href}
              className="link-sidebar"
              {...(node.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {node.text}
            </a>
          );
        }
        return <span key={i}>{node.text}</span>;
      })}
    </>
  );
}

export function LegalDocument({ docKey, doc }: { docKey: LegalDocKey; doc: LegalDoc }) {
  const blocks = parseLegalMarkdown(doc.body, TOKEN_VALUES);
  const otherKey: LegalDocKey = docKey === 'privacy' ? 'terms' : 'privacy';

  return (
    <article className="lobby-page-intro max-w-3xl pb-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-title-page">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Last updated <time dateTime={doc.lastUpdated}>{formatDate(doc.lastUpdated)}</time>
        </p>
      </header>

      <div className="space-y-4 text-sm leading-relaxed text-primary/90 sm:text-base">
        {blocks.map((block, i) => {
          switch (block.type) {
            case 'h2':
              return (
                <h2
                  key={i}
                  id={block.id}
                  className="font-heading-section scroll-mt-6 pt-4 first:pt-0"
                >
                  {block.text}
                </h2>
              );
            case 'h3':
              return (
                <h3 key={i} className="font-heading-sub pt-1">
                  {block.text}
                </h3>
              );
            case 'ul':
              return (
                <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted">
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Inlines inlines={item} />
                    </li>
                  ))}
                </ul>
              );
            default:
              return (
                <p key={i}>
                  <Inlines inlines={block.inlines} />
                </p>
              );
          }
        })}
      </div>

      <footer className="mt-10 border-t border-subtle/15 pt-4 text-sm text-muted">
        See also our{' '}
        <Link href={LEGAL_DOC_PATHS[otherKey]} className="link-sidebar">
          {otherKey === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
        </Link>
        .
      </footer>
    </article>
  );
}
