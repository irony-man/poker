import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { FORM_LABEL_CLASS } from '@/components/ui/TextField';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export const LABEL_CLASS = FORM_LABEL_CLASS;

export const ADMIN_SAVE_BTN = 'min-h-11 w-full sm:w-auto sm:min-w-[12rem]';

export const ADMIN_TABLE_SHELL =
  'overflow-x-auto overflow-hidden rounded-xl border border-sidebar/12';

export const ADMIN_TABLE_HEAD_CELL = 'px-3 py-2.5';

export const ADMIN_ROW_DIVIDER = 'border-b border-sidebar/6 last:border-0';

export const ADMIN_ROW_INTERACTIVE =
  'cursor-pointer transition hover:bg-sidebar/[0.03]';

export const ADMIN_CELL_PRIMARY = 'font-medium text-primary';

export const ADMIN_CELL_PRIMARY_DISPLAY =
  'font-display text-sm font-semibold text-primary';

export const ADMIN_CELL_SECONDARY = 'text-sm text-muted';

export const ADMIN_CELL_MONO = 'font-mono text-xs text-primary';

export const ADMIN_CELL_NUMBERS_MUTED = 'tabular-nums text-muted';

export const ADMIN_CELL_NUMBERS_PRIMARY = 'tabular-nums text-primary';

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
    <section id={id} className="surface-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-sidebar/8 pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-primary">
            {title}
          </h2>
          {description ? (
            <p className="font-prose-muted mt-1 max-w-2xl">
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

export function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const inner = (
    <>
      <p className="font-kicker-xs">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-sidebar">{value}</p>
    </>
  );
  const className = cn(
    'min-w-[7.5rem] flex-1 rounded-xl border border-sidebar/12 bg-raised px-4 py-3 shadow-sm',
    href && 'transition hover:border-sidebar/25 hover:brightness-[0.98]',
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-kicker mb-2">
      {children}
    </h3>
  );
}

export function DetailTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-lg font-bold tracking-tight text-primary">
      {children}
    </h3>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

export function AdminTableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(ADMIN_TABLE_SHELL, className)}>{children}</div>;
}

export function AdminTableHeadRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('admin-table-head', ADMIN_TABLE_HEAD_CELL, className)}>
      {children}
    </div>
  );
}

export function AdminTableBodyRow({
  children,
  className,
  interactive,
  active,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        ADMIN_TABLE_HEAD_CELL,
        ADMIN_ROW_DIVIDER,
        interactive && ADMIN_ROW_INTERACTIVE,
        active && 'bg-sidebar/[0.03]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminExpandPanel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'border-t border-sidebar/8 bg-page/[0.55] px-3 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('surface-row', className)}>{children}</div>;
}

export function PanelBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-sidebar/12 bg-page/[0.55] p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ul className={cn('surface-list', className)}>{children}</ul>;
}

export function AdminListRow({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 px-3 py-2 transition hover:bg-sidebar/[0.03]',
        className,
      )}
      {...rest}
    >
      {children}
    </li>
  );
}

export function DataTable({
  children,
  minWidth,
  empty,
}: {
  children: ReactNode;
  minWidth?: string;
  empty?: ReactNode;
}) {
  return (
    <AdminTableShell>
      <table className="w-full text-left text-sm" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
      {empty}
    </AdminTableShell>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="admin-table-head">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn(ADMIN_TABLE_HEAD_CELL, className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn(ADMIN_TABLE_HEAD_CELL, className)} {...rest}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        ADMIN_ROW_DIVIDER,
        onClick && ADMIN_ROW_INTERACTIVE,
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <label className="surface-row flex cursor-pointer items-center gap-3 py-3 text-sm text-primary">
      <input
        type="checkbox"
        className="h-4 w-4 accent-sidebar"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SaveBar({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar/8 pt-4">
      {hint ? <p className="text-xs text-muted">{hint}</p> : <span />}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function SplitPane({
  sidebar,
  sidebarLabel,
  children,
}: {
  sidebar: ReactNode;
  sidebarLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-sidebar/12 bg-raised lg:grid-cols-[minmax(13.5rem,18rem)_minmax(0,1fr)]">
      <div
        className="flex flex-col gap-0.5 overflow-y-auto border-b border-sidebar/12 bg-sidebar/[0.08] p-2 lg:max-h-[min(70vh,44rem)] lg:border-b-0 lg:border-r"
        role="listbox"
        aria-label={sidebarLabel}
      >
        {sidebar}
      </div>
      <div className="min-w-0 bg-raised/80 p-4 sm:p-6">{children}</div>
    </div>
  );
}

export function SplitGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-kicker-xs px-3 pb-1 pt-2.5 first:pt-1">
      {children}
    </p>
  );
}

export function SplitItem({
  selected,
  title,
  meta,
  badge,
  onSelect,
}: {
  selected: boolean;
  title: string;
  meta?: string;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
        selected
          ? 'bg-sidebar text-on-chrome shadow-[0_4px_12px_rgb(29_4_50/0.16)]'
          : 'text-primary hover:bg-sidebar/[0.08]'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={`truncate font-display text-sm font-semibold uppercase tracking-wider ${
            selected ? 'text-on-chrome' : 'text-primary'
          }`}
        >
          {title}
        </span>
        {badge ? (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
              selected ? 'bg-on-chrome/20 text-on-chrome' : 'bg-sidebar/10 text-sidebar'
            }`}
          >
            {badge}
          </span>
        ) : null}
      </span>
      {meta ? (
        <span
          className={`mt-0.5 block truncate text-xs ${
            selected ? 'text-on-chrome/70' : 'text-muted'
          }`}
        >
          {meta}
        </span>
      ) : null}
    </button>
  );
}

export function DetailHeader({
  title,
  meta,
  actions,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-sidebar/8 pb-4">
      <div className="min-w-0 flex-1">{title}{meta}</div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyPane({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-16 text-center text-sm text-muted">{children}</p>
  );
}
