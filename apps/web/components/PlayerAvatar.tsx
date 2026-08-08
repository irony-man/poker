'use client';

import Image from 'next/image';
import {
  AVATAR_LABELS,
  AVATAR_PRESET_COUNT,
  avatarSrc,
  resolveAvatarId,
} from '@/lib/avatars';

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
  const label = title ?? AVATAR_LABELS[id] ?? `Avatar ${id + 1}`;
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-ink-raised ${
        fill ? 'h-full w-full' : 'shrink-0'
      } ${className}`}
      style={fill ? undefined : { width: size, height: size }}
      title={label}
      aria-hidden={!title}
    >
      <Image
        src={avatarSrc(id)}
        alt=""
        fill
        sizes={`${Math.max(size, 48)}px`}
        className="object-cover object-center"
        draggable={false}
      />
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
  const chip = 40;
  return (
    <div className="w-full max-w-md">
      <span className="hud-label">Profile picture</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: AVATAR_PRESET_COUNT }, (_, id) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full p-0.5 transition sm:size-11 ${
                selected
                  ? 'ring-2 ring-sidebar'
                  : 'hover:bg-sidebar/5'
              }`}
              aria-label={AVATAR_LABELS[id]}
              aria-pressed={selected}
            >
              {/* Fixed size — avoid % height under aspect-ratio (collapses to blank). */}
              <PlayerAvatar avatarId={id} size={chip} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
