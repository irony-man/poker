import type { HTMLAttributes, ReactNode } from 'react';

const tones = {
  positive: 'notice-positive',
  danger: 'notice-danger',
  info: 'notice-info',
} as const;

export type NoticeTone = keyof typeof tones;

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 shrink-0"
      aria-hidden
    >
      {tone === 'positive' ? (
        <path d="M20 6 9 17l-5-5" />
      ) : tone === 'danger' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5h.01" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.5h.01" />
        </>
      )}
    </svg>
  );
}

/** Sentence-length message block (StatusChip is for short uppercase labels). */
export function Notice({
  tone = 'info',
  title,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`notice ${tones[tone]} ${className}`.trim()} {...props}>
      <NoticeIcon tone={tone} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div> : null}
      </div>
    </div>
  );
}
