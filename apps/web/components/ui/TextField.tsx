'use client';

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export const FORM_FIELD_CLASS =
  'w-full rounded-lg border border-sidebar/15 bg-cream px-3 py-2.5 text-sm text-ink-strong shadow-sm outline-none transition placeholder:text-ink-strong-muted/50 focus:border-sidebar/40 focus:ring-2 focus:ring-sidebar/10';

export const FORM_LABEL_CLASS =
  'block text-xs font-display font-semibold uppercase tracking-[0.12em] text-ink-strong-muted';

type FieldVariant = 'hud' | 'form';

function fieldClass(variant: FieldVariant, extra = '') {
  const base = variant === 'hud' ? 'hud-input' : FORM_FIELD_CLASS;
  return extra ? `${base} ${extra}` : base;
}

function FieldWrap({
  id,
  label,
  help,
  variant,
  children,
}: {
  id?: string;
  label?: ReactNode;
  help?: ReactNode;
  variant: FieldVariant;
  children: ReactNode;
}) {
  if (!label && !help) return children;
  const labelClass = variant === 'hud' ? 'hud-label' : FORM_LABEL_CLASS;
  return (
    <label className="block w-full" htmlFor={id}>
      {label ? <span className={labelClass}>{label}</span> : null}
      <span className={label ? 'mt-1.5 block' : undefined}>{children}</span>
      {help ? <p className="field-help mt-1.5">{help}</p> : null}
    </label>
  );
}

function EyeIcon({ slashed }: { slashed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {slashed ? <path d="M3 3l18 18" /> : null}
    </svg>
  );
}

export function TextField({
  label,
  help,
  variant = 'form',
  className = '',
  id,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  help?: ReactNode;
  variant?: FieldVariant;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const isPassword = type === 'password';
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputType = isPassword ? (passwordVisible ? 'text' : 'password') : type;

  const input = (
    <input
      id={fieldId}
      type={inputType}
      className={fieldClass(variant, cn(isPassword && 'pr-11', className))}
      {...props}
    />
  );

  return (
    <FieldWrap id={fieldId} label={label} help={help} variant={variant}>
      {isPassword ? (
        <span className="relative block">
          {input}
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-ink-strong-muted transition hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/25"
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            aria-controls={fieldId}
            onClick={() => setPasswordVisible((v) => !v)}
          >
            <EyeIcon slashed={passwordVisible} />
          </button>
        </span>
      ) : (
        input
      )}
    </FieldWrap>
  );
}

export function TextAreaField({
  label,
  help,
  className = '',
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  help?: ReactNode;
}) {
  return (
    <FieldWrap id={id} label={label} help={help} variant="form">
      <textarea id={id} className={fieldClass('form', className)} {...props} />
    </FieldWrap>
  );
}

export function SelectField({
  label,
  help,
  className = '',
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FieldWrap id={id} label={label} help={help} variant="form">
      <select id={id} className={fieldClass('form', className)} {...props}>
        {children}
      </select>
    </FieldWrap>
  );
}
