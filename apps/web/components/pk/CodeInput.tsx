'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

/** Six cells. Extra digits up to 8 are kept in the value for the existing 4–8 digit room codes. */
export function PkCodeInput({
  value,
  onChange,
  length = 6,
  disabled,
  label = 'Invite code',
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  label?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const cells = Array.from({ length }, (_, index) => value[index] ?? '');

  function write(next: string) {
    onChange(next.replace(/\D/g, '').slice(0, 8));
  }

  return (
    <div role="group" aria-label={label} className="flex gap-pk-2">
      {cells.map((cell, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`${label} digit ${index + 1}`}
          disabled={disabled}
          value={cell}
          maxLength={index === 0 ? 8 : 1}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '');
            if (digits.length > 1) {
              write(digits);
              const focusAt = Math.min(length - 1, digits.length);
              refs.current[focusAt]?.focus();
              return;
            }
            const chars = value.padEnd(length, ' ').split('');
            chars[index] = digits;
            write(chars.join('').replace(/\s/g, ''));
            if (digits && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !cell && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          className={cn(
            'h-12 w-11 rounded-pk-md border border-subtle/40 bg-raised text-center font-pk-display text-pk-h4 tabular-nums text-primary',
          )}
        />
      ))}
    </div>
  );
}
