import type { ReactNode } from 'react';
import { FORM_LABEL_CLASS } from '@/components/ui/TextField';

export const LABEL_CLASS = FORM_LABEL_CLASS;

export function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-sidebar/10 bg-cream/90 p-4 shadow-[0_8px_28px_rgb(29_4_50/0.06)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-sidebar/8 pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-ink-strong">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-strong-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[7.5rem] flex-1 rounded-xl border border-sidebar/10 bg-cream px-4 py-3 shadow-sm">
      <p className="text-[10px] font-display font-semibold uppercase tracking-[0.16em] text-ink-strong-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-sidebar">{value}</p>
    </div>
  );
}
