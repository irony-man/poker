import type { ReactNode } from 'react';

export function CollapsibleSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="surface-row group px-0 py-0">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-sm outline-none marker:content-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-sidebar/30">
        <span className="min-w-0 flex-1">
          <span className="hud-label block">{title}</span>
          <span className="mt-1 block text-[0.8125rem] font-medium leading-snug text-ink-strong-muted">
            {summary}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-ink-strong transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-5 border-t border-sidebar/10 px-3.5 py-4">{children}</div>
    </details>
  );
}
