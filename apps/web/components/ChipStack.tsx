'use client';

/** Visual chip stack — denominations inspired by classic casino colors. */
const DENOMS = [
  { value: 1000, className: 'bg-[#1a1a1a] border-[#c9a227]' },
  { value: 500, className: 'bg-[#5b21b6] border-[#c4b5fd]' },
  { value: 100, className: 'bg-[#111827] border-[#f3f4f6]' },
  { value: 25, className: 'bg-[#166534] border-[#86efac]' },
  { value: 10, className: 'bg-[#1d4ed8] border-[#93c5fd]' },
  { value: 5, className: 'bg-[#b91c1c] border-[#fecaca]' },
  { value: 1, className: 'bg-[#e5e7eb] border-[#6b7280]' },
] as const;

function breakDown(amount: number): { value: number; count: number; className: string }[] {
  let remaining = Math.max(0, Math.floor(amount));
  const parts: { value: number; count: number; className: string }[] = [];
  for (const d of DENOMS) {
    const count = Math.floor(remaining / d.value);
    if (count > 0) {
      parts.push({ value: d.value, count: Math.min(count, 8), className: d.className });
      remaining -= count * d.value;
    }
  }
  return parts;
}

export function formatChips(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function ChipStack({
  amount,
  size = 'md',
  label,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  label?: boolean;
}) {
  if (amount <= 0) return null;
  const parts = breakDown(amount);
  const chip =
    size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const gap = size === 'sm' ? 1.5 : 2;

  return (
    <div className="inline-flex items-end gap-1.5">
      {parts.map((p) => (
        <div key={p.value} className="relative" style={{ width: size === 'lg' ? 22 : 16, height: 10 + p.count * gap }}>
          {Array.from({ length: p.count }).map((_, i) => (
            <span
              key={i}
              className={`absolute left-0 rounded-full border-2 shadow-sm ${chip} ${p.className}`}
              style={{ bottom: i * gap }}
              title={`${p.value}`}
            />
          ))}
        </div>
      ))}
      {label !== false && (
        <span className={`font-semibold tabular-nums ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
          {formatChips(amount)}
        </span>
      )}
    </div>
  );
}
