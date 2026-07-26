'use client';

import { motion } from 'framer-motion';

/** Casino chip palette with rim colors + edge marks. */
const DENOMS = [
  { value: 1000, face: '#111111', rim: '#c9a227', mark: '#e8d48b' },
  { value: 500, face: '#5b21b6', rim: '#ddd6fe', mark: '#f5f3ff' },
  { value: 100, face: '#0f172a', rim: '#f8fafc', mark: '#e2e8f0' },
  { value: 25, face: '#15803d', rim: '#bbf7d0', mark: '#dcfce7' },
  { value: 10, face: '#1d4ed8', rim: '#bfdbfe', mark: '#dbeafe' },
  { value: 5, face: '#b91c1c', rim: '#fecaca', mark: '#fee2e2' },
  { value: 1, face: '#e7e5e4', rim: '#78716c', mark: '#a8a29e' },
] as const;

function breakDown(amount: number) {
  let remaining = Math.max(0, Math.floor(amount));
  const parts: { value: number; count: number; face: string; rim: string; mark: string }[] = [];
  for (const d of DENOMS) {
    const count = Math.floor(remaining / d.value);
    if (count > 0) {
      parts.push({
        value: d.value,
        count: Math.min(count, 10),
        face: d.face,
        rim: d.rim,
        mark: d.mark,
      });
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

function ChipDisc({
  face,
  rim,
  mark,
  size,
  label,
}: {
  face: string;
  rim: string;
  mark: string;
  size: number;
  label?: string;
}) {
  return (
    <span
      className="relative inline-block rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${rim}55, ${face} 55%, #00000055 100%)`,
        boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.08)}px ${rim}, 0 2px 4px rgba(0,0,0,0.4)`,
      }}
    >
      {/* edge ticks */}
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-0 origin-bottom"
          style={{
            width: Math.max(2, size * 0.1),
            height: size * 0.18,
            marginLeft: -Math.max(1, size * 0.05),
            background: mark,
            transform: `rotate(${i * 45}deg) translateY(0)`,
            borderRadius: 1,
            opacity: 0.9,
          }}
        />
      ))}
      <span
        className="absolute inset-[22%] rounded-full flex items-center justify-center font-bold"
        style={{
          background: `radial-gradient(circle at 40% 35%, ${rim}33, ${face})`,
          color: mark,
          fontSize: Math.max(7, size * 0.28),
          textShadow: '0 1px 1px rgba(0,0,0,0.35)',
        }}
      >
        {label}
      </span>
    </span>
  );
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
  const disc = size === 'sm' ? 18 : size === 'lg' ? 34 : 24;
  const gap = size === 'sm' ? 2.2 : size === 'lg' ? 3.4 : 2.8;

  return (
    <div className="inline-flex items-end gap-2">
      {parts.map((p) => (
        <motion.div
          key={p.value}
          className="relative"
          style={{ width: disc, height: disc * 0.45 + p.count * gap }}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
        >
          {Array.from({ length: p.count }).map((_, i) => (
            <span
              key={i}
              className="absolute left-0"
              style={{ bottom: i * gap }}
            >
              <ChipDisc
                face={p.face}
                rim={p.rim}
                mark={p.mark}
                size={disc}
                label={size === 'lg' ? String(p.value >= 1000 ? `${p.value / 1000}k` : p.value) : undefined}
              />
            </span>
          ))}
        </motion.div>
      ))}
      {label !== false && (
        <span
          className={`font-semibold tabular-nums drop-shadow ${
            size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs'
          }`}
        >
          {formatChips(amount)}
        </span>
      )}
    </div>
  );
}
