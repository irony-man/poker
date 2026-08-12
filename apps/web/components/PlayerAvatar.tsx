'use client';

import Image from 'next/image';
import {
  AVATAR_LABELS,
  AVATAR_PRESET_COUNT,
  avatarSrc,
  resolveAvatarId,
  resolveAvatarSrc,
} from '@/lib/avatars';

function isRemoteAvatarSrc(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://');
}

export function PlayerAvatar({
  avatarId,
  avatarUrl,
  userId,
  size = 48,
  className = '',
  title,
  fill = false,
}: {
  avatarId?: number | null;
  avatarUrl?: string | null;
  userId?: string | null;
  size?: number;
  className?: string;
  title?: string;
  /** Expand to parent size (parent should set dimensions). */
  fill?: boolean;
}) {
  const id = resolveAvatarId(userId, avatarId);
  const src = resolveAvatarSrc({ avatarUrl, avatarId: id, userId });
  const label = title ?? AVATAR_LABELS[id] ?? `Avatar ${id + 1}`;
  const remote = isRemoteAvatarSrc(src);

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-ink-raised ${
        fill ? 'h-full w-full' : 'shrink-0'
      } ${className}`}
      style={fill ? undefined : { width: size, height: size }}
      title={label}
      aria-hidden={!title}
    >
      {remote ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover object-center"
          draggable={false}
        />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${Math.max(size, 48)}px`}
          className="object-cover object-center"
          draggable={false}
        />
      )}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
  onUpload,
  uploading = false,
}: {
  value: number;
  onChange: (id: number) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
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
              <PlayerAvatar avatarId={id} size={chip} />
            </button>
          );
        })}
      </div>
      {onUpload ? (
        <div className="mt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sidebar/20 px-3 py-2 text-sm hover:bg-sidebar/5">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = '';
              }}
            />
            {uploading ? 'Uploading…' : 'Upload photo'}
          </label>
        </div>
      ) : null}
    </div>
  );
}
