'use client';

import { AVATAR_LABELS, AVATAR_PRESET_COUNT, resolveAvatarId } from '@/lib/avatars';

const PALETTES = [
  { bg: '#1a2332', accent: '#3de0ff', ink: '#e8eef5' },
  { bg: '#2a1520', accent: '#ff6b8a', ink: '#ffe8ee' },
  { bg: '#1e2a18', accent: '#2aff9a', ink: '#e8ffe8' },
  { bg: '#2a2410', accent: '#e0b43a', ink: '#fff6d8' },
  { bg: '#1a1a2e', accent: '#a78bfa', ink: '#f0e8ff' },
  { bg: '#241810', accent: '#fb923c', ink: '#fff0e0' },
  { bg: '#102428', accent: '#2dd4bf', ink: '#e0fffa' },
  { bg: '#281018', accent: '#f472b6', ink: '#ffe8f4' },
] as const;

function SuitGlyph({ id, accent }: { id: number; accent: string }) {
  switch (id % AVATAR_PRESET_COUNT) {
    case 0: // spade
      return (
        <path
          fill={accent}
          d="M32 10c-8 10-16 16-16 24a10 10 0 0 0 16.5 7.6L32 46l-.5-4.4A10 10 0 0 0 48 34c0-8-8-14-16-24z"
        />
      );
    case 1: // heart
      return (
        <path
          fill={accent}
          d="M32 46c-2-2-18-14-18-26a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 12-16 24-18 26z"
        />
      );
    case 2: // diamond
      return <path fill={accent} d="M32 8 50 32 32 56 14 32z" />;
    case 3: // club
      return (
        <g fill={accent}>
          <circle cx="22" cy="26" r="8" />
          <circle cx="42" cy="26" r="8" />
          <circle cx="32" cy="16" r="8" />
          <path d="M30 30h4v14h-4z" />
        </g>
      );
    case 4: // chip
      return (
        <g>
          <circle cx="32" cy="32" r="18" fill="none" stroke={accent} strokeWidth="4" />
          <circle cx="32" cy="32" r="10" fill={accent} opacity="0.35" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={32 + Math.cos(r) * 18}
                cy={32 + Math.sin(r) * 18}
                r="2.2"
                fill={accent}
              />
            );
          })}
        </g>
      );
    case 5: // crown
      return (
        <path
          fill={accent}
          d="M14 42V22l8 8 10-14 10 14 8-8v20H14zm2 4h32v4H16z"
        />
      );
    case 6: // dice
      return (
        <g>
          <rect x="16" y="16" width="32" height="32" rx="6" fill={accent} opacity="0.9" />
          <circle cx="24" cy="24" r="3" fill="#0a0e12" />
          <circle cx="40" cy="24" r="3" fill="#0a0e12" />
          <circle cx="32" cy="32" r="3" fill="#0a0e12" />
          <circle cx="24" cy="40" r="3" fill="#0a0e12" />
          <circle cx="40" cy="40" r="3" fill="#0a0e12" />
        </g>
      );
    default: // ace
      return (
        <g>
          <rect x="18" y="12" width="28" height="40" rx="3" fill={accent} opacity="0.2" stroke={accent} strokeWidth="2" />
          <text
            x="32"
            y="40"
            textAnchor="middle"
            fill={accent}
            fontSize="22"
            fontFamily="Georgia, serif"
            fontWeight="700"
          >
            A
          </text>
        </g>
      );
  }
}

export function PlayerAvatar({
  avatarId,
  userId,
  size = 48,
  className = '',
  title,
  fill = false,
}: {
  avatarId?: number | null;
  userId?: string | null;
  size?: number;
  className?: string;
  title?: string;
  /** Expand to parent size (parent should set dimensions). */
  fill?: boolean;
}) {
  const id = resolveAvatarId(userId, avatarId);
  const palette = PALETTES[id]!;
  return (
    <div
      className={`relative overflow-hidden rounded-full ring-1 ring-white/15 shadow-md ${
        fill ? 'h-full w-full' : 'shrink-0'
      } ${className}`}
      style={
        fill
          ? { background: palette.bg }
          : { width: size, height: size, background: palette.bg }
      }
      title={title ?? AVATAR_LABELS[id]}
      aria-hidden={!title}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <SuitGlyph id={id} accent={palette.accent} />
      </svg>
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="w-full">
      <span className="hud-label">Profile picture</span>
      <div className="mt-2 flex w-full gap-1.5 sm:gap-2">
        {Array.from({ length: AVATAR_PRESET_COUNT }, (_, id) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`min-w-0 flex-1 aspect-square rounded-full p-[6%] transition ${
                selected
                  ? 'ring-2 ring-sidebar shadow-[0_0_0_1px_rgb(var(--sidebar)/0.2)]'
                  : 'ring-1 ring-sidebar/20 hover:ring-sidebar/45'
              }`}
              aria-label={AVATAR_LABELS[id]}
              aria-pressed={selected}
            >
              <PlayerAvatar avatarId={id} fill />
            </button>
          );
        })}
      </div>
    </div>
  );
}
