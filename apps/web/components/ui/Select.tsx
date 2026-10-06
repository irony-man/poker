'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type SelectOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** Plain text for type-ahead when `label` is not a string. */
  textValue?: string;
  disabled?: boolean;
};

export type SelectSize = 'xs' | 'sm' | 'md';

/* Paper fill + fixed dark ink, matching FORM_FIELD_CLASS (Glass page ground is light-on-dusk). */
const TRIGGER_BASE =
  'group relative flex w-full cursor-pointer items-center gap-2 border border-sidebar/15 bg-white text-left text-[rgb(22_12_40)] shadow-sm outline-none transition hover:border-sidebar/35 focus-visible:border-sidebar/45 focus-visible:ring-2 focus-visible:ring-sidebar/15 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light]';

const TRIGGER_SIZE: Record<SelectSize, string> = {
  xs: 'min-h-7 rounded-md px-2 py-1 text-[11px] font-semibold',
  sm: 'min-h-9 rounded-xl px-3 py-1.5 text-sm font-semibold',
  md: 'min-h-[2.75rem] rounded-lg px-3 py-2.5 text-sm',
};

const OPTION_SIZE: Record<SelectSize, string> = {
  xs: 'px-2 py-1.5 text-xs',
  sm: 'px-2.5 py-2 text-sm',
  md: 'px-3 py-2.5 text-sm',
};

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 288;
const VIEWPORT_MARGIN = 8;

function optionText(o: SelectOption): string {
  if (o.textValue) return o.textValue;
  return typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.value;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        'ml-auto h-3.5 w-3.5 shrink-0 text-sidebar/70 transition-transform duration-150',
        open && 'rotate-180',
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="ml-auto h-4 w-4 shrink-0 text-sidebar"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type SelectProps<T extends string> = {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: ReactNode;
  size?: SelectSize;
  /** Leading icon inside the trigger. */
  icon?: ReactNode;
  disabled?: boolean;
  id?: string;
  /** Renders a hidden input so the value posts with a surrounding form. */
  name?: string;
  className?: string;
  menuClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/**
 * Themed single-select (select-only combobox). Use instead of a native `<select>` so the
 * option list matches the app chrome. Focus stays on the trigger; arrows, Home/End,
 * Enter/Space, Escape and type-ahead behave like a native select.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  size = 'md',
  icon,
  disabled,
  id,
  name,
  className,
  menuClassName,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectProps<T>) {
  const autoId = useId();
  const triggerId = id ?? `select-${autoId}`;
  const listId = `${triggerId}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const typeahead = useRef({ text: '', at: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const firstEnabled = useCallback(
    (from: number, step: 1 | -1) => {
      for (let i = from; i >= 0 && i < options.length; i += step) {
        if (!options[i]!.disabled) return i;
      }
      return -1;
    },
    [options],
  );

  const openMenu = useCallback(
    (highlight?: number) => {
      if (disabled || options.length === 0) return;
      setActive(highlight ?? (selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1)));
      setOpen(true);
    },
    [disabled, options.length, selectedIndex, firstEnabled],
  );

  const close = useCallback(() => {
    setOpen(false);
    setMenuStyle(null);
  }, []);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      close();
      triggerRef.current?.focus();
      if (opt.value !== value) onChange(opt.value);
    },
    [options, value, onChange, close],
  );

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const natural = Math.min(listRef.current?.scrollHeight ?? MENU_MAX_HEIGHT, MENU_MAX_HEIGHT);
    const up = below < natural && above > below;
    const maxHeight = Math.max(96, Math.min(MENU_MAX_HEIGHT, up ? above : below));
    const minWidth = rect.width;
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), Math.max(VIEWPORT_MARGIN, vw - minWidth - VIEWPORT_MARGIN));
    setPlacement(up ? 'up' : 'down');
    setMenuStyle({
      position: 'fixed',
      left,
      minWidth,
      maxWidth: Math.max(minWidth, vw - left - VIEWPORT_MARGIN),
      maxHeight,
      ...(up ? { bottom: vh - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, position, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      position();
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', position);
    };
  }, [open, close, position]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active, menuStyle]);

  useEffect(() => {
    if (disabled && open) close();
  }, [disabled, open, close]);

  const matchTypeahead = (char: string): number => {
    const now = Date.now();
    const t = typeahead.current;
    t.text = now - t.at > 600 ? char : t.text + char;
    t.at = now;
    const query = t.text.toLowerCase();
    // Repeating one letter cycles through matches, like a native select.
    const cycle = [...query].every((c) => c === query[0]);
    const needle = cycle ? query[0]! : query;
    const start = (open ? active : selectedIndex) + (cycle ? 1 : 0);
    const n = options.length;
    for (let k = 0; k < n; k++) {
      const i = (((start + k) % n) + n) % n;
      const o = options[i]!;
      if (!o.disabled && optionText(o).toLowerCase().startsWith(needle)) return i;
    }
    return -1;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      } else if (e.key === 'Home') {
        e.preventDefault();
        openMenu(firstEnabled(0, 1));
      } else if (e.key === 'End') {
        e.preventDefault();
        openMenu(firstEnabled(last, -1));
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = matchTypeahead(e.key);
        if (i >= 0) openMenu(i);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = firstEnabled(active + 1, 1);
        if (next >= 0) setActive(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (e.altKey) {
          commit(active);
          break;
        }
        const prev = firstEnabled(active - 1, -1);
        if (prev >= 0) setActive(prev);
        break;
      }
      case 'Home':
      case 'PageUp':
        e.preventDefault();
        setActive(firstEnabled(0, 1));
        break;
      case 'End':
      case 'PageDown':
        e.preventDefault();
        setActive(firstEnabled(last, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        close();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = matchTypeahead(e.key);
          if (i >= 0) setActive(i);
        }
    }
  };

  const optionId = (i: number) => `${triggerId}-opt-${i}`;

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          TRIGGER_BASE,
          TRIGGER_SIZE[size],
          open && 'border-sidebar/45 ring-2 ring-sidebar/15',
          className,
        )}
      >
        {icon ? (
          <span className="flex shrink-0 items-center text-sidebar" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className={cn('min-w-0 truncate', !selected && 'text-[rgb(58_40_82)]/75')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? triggerId)}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              style={menuStyle ?? { position: 'fixed', visibility: 'hidden' }}
              className={cn(
                'z-[95] overflow-y-auto overscroll-contain rounded-xl border border-sidebar/[0.12] bg-white p-1 text-[rgb(22_12_40)] shadow-[0_14px_40px_rgb(29_4_50/0.18)] [color-scheme:light]',
                'animate-select-menu-in motion-reduce:animate-none',
                placement === 'up' ? 'origin-bottom' : 'origin-top',
                menuClassName,
              )}
            >
              {options.map((o, i) => {
                const isSelected = i === selectedIndex;
                const isActive = i === active;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onPointerMove={() => {
                      if (!o.disabled && active !== i) setActive(i);
                    }}
                    onClick={() => commit(i)}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-2 rounded-lg transition-colors',
                      OPTION_SIZE[size],
                      isActive && 'bg-sidebar/[0.08]',
                      isSelected && 'font-semibold text-sidebar',
                      o.disabled && 'cursor-not-allowed opacity-45',
                    )}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {isSelected ? <CheckIcon /> : null}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
