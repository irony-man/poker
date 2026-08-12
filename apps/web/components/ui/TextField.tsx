import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

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

export function TextField({
  label,
  help,
  variant = 'form',
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  help?: ReactNode;
  variant?: FieldVariant;
}) {
  return (
    <FieldWrap id={id} label={label} help={help} variant={variant}>
      <input id={id} className={fieldClass(variant, className)} {...props} />
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
