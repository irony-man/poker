'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PkTextField({
  label,
  error,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null }) {
  const fieldId = id ?? props.name;
  return (
    <label className="flex flex-col gap-pk-2 text-left" htmlFor={fieldId}>
      <span className="font-pk-body text-pk-label text-primary">{label}</span>
      <input
        id={fieldId}
        className={cn(
          'min-h-11 rounded-pk-md border bg-raised px-pk-3 text-pk-body-md text-primary',
          error ? 'border-danger' : 'border-subtle/40',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${fieldId}-error`} className="text-pk-caption text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function PkToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-pk-3 text-pk-body-md"
    >
      <span
        className={cn(
          'relative h-6 w-11 rounded-pk-full transition',
          checked ? 'bg-chrome' : 'bg-subtle/40',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-pk-full bg-raised shadow-pk-sm',
            checked ? 'left-5' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function PkCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-pk-2 text-pk-body-md">
      <input
        type="checkbox"
        className="h-5 w-5 rounded-pk-sm"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
