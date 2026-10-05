import Link from 'next/link';
import { LEGAL_DOC_PATHS } from '@poker/protocol';
import { cn } from '@/lib/cn';

/** "Privacy · Terms" footer row. */
export function LegalLinks({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <nav aria-label="Legal" className={cn('flex items-center justify-center gap-2', className)}>
      <Link href={LEGAL_DOC_PATHS.privacy} className={linkClassName}>
        Privacy
      </Link>
      <span aria-hidden>·</span>
      <Link href={LEGAL_DOC_PATHS.terms} className={linkClassName}>
        Terms
      </Link>
    </nav>
  );
}
