'use client';

import type { ReactNode } from 'react';
import { avatarSrc } from '@/lib/avatars';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';

export function PkBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'live' | 'new' | 'free';
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-pk-full px-pk-2 text-[12px] font-semibold uppercase tracking-[0.07em]',
        tone === 'new' && 'bg-ds-new-badge text-white',
        tone === 'live' && 'bg-positive text-white',
        tone === 'free' && 'bg-ds-chip text-white',
        tone === 'neutral' && 'bg-raised text-muted',
      )}
    >
      {children}
    </span>
  );
}

/** Designer avatars map in order onto avatarId 0–7. Falls back to the live preset URL. */
export function PkAvatar({
  avatarId = 0,
  name,
  src,
  size = 40,
}: {
  avatarId?: number | null;
  name: string;
  src?: string | null;
  size?: number;
}) {
  const url = src || avatarSrc(avatarId ?? 0);
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="rounded-pk-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function PkChipStack({ amount, label }: { amount: number; label?: string }) {
  const count = Math.max(1, Math.min(5, Math.ceil(amount / 100)));
  return (
    <span className="inline-flex items-center gap-pk-1 tabular-nums" aria-label={label ?? `${amount} chips`}>
      <span className="flex" aria-hidden>
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className="-ml-1 h-3 w-3 rounded-pk-full border border-white/70 bg-ds-chip first:ml-0"
          />
        ))}
      </span>
      <span className="text-pk-caption font-semibold">{amount.toLocaleString('en-US')}</span>
    </span>
  );
}

export function PkPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-pk-6 flex flex-wrap items-end justify-between gap-pk-4">
      <div>
        <p className="text-pk-overline uppercase text-muted">Poker</p>
        <h1 className="font-pk-display text-pk-display-lg">{title}</h1>
        {subtitle ? <p className="mt-pk-2 max-w-xl text-pk-body-md text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function PkTabs({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-pk-4 flex gap-pk-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          onClick={() => onChange(option.id)}
          className={cn(
            'min-h-11 rounded-pk-full px-pk-4 text-pk-label',
            option.id === value ? 'bg-chrome text-on-chrome' : 'bg-raised text-primary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PkEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-pk-xl border border-dashed border-subtle/40 bg-raised p-pk-8 text-center">
      <h2 className="font-pk-display text-pk-h3">{title}</h2>
      <p className="mx-auto mt-pk-2 max-w-md text-pk-body-md text-muted">{body}</p>
      {action ? <div className="mt-pk-4">{action}</div> : null}
    </div>
  );
}

export function PkSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-pk-md bg-subtle/20', className)} aria-hidden />;
}

export function pkToast(kind: 'info' | 'success' | 'error', message: string): void {
  toast[kind](message);
}
