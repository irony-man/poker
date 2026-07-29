'use client';

import { useEffect, useMemo, useRef } from 'react';

export function VideoTile({
  stream,
  label,
  muted = false,
  mirror = false,
  className = '',
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  const hasVideo = !!stream?.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-cream/20 bg-ink ${className}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirror ? 'scale-x-[-1]' : ''} ${
          hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised px-1 text-center text-[9px] uppercase tracking-wider text-cream/40">
          {label.slice(0, 8)}
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[8px] font-semibold text-cream">
        {label}
      </span>
    </div>
  );
}

/** Compact horizontal strip (portrait / desktop). */
export function VideoCallStrip({
  localStream,
  localName,
  cameraOn,
  wantsVideo,
  remotes,
}: {
  localStream: MediaStream | null;
  localName: string;
  cameraOn: boolean;
  wantsVideo: boolean;
  remotes: { userId: string; name: string; stream: MediaStream }[];
}) {
  if (!videoActive(cameraOn, wantsVideo, remotes)) return null;

  return (
    <div className="mb-1 flex gap-1.5 overflow-x-auto pb-0.5 sm:mb-2 sm:gap-2 sm:pb-1">
      <VideoTile
        stream={cameraOn ? localStream : null}
        label={`${localName} (you)`}
        muted
        mirror
        className="h-16 w-[5.5rem] shrink-0 sm:h-28 sm:w-36"
      />
      {remotes.map((r) => (
        <VideoTile
          key={r.userId}
          stream={r.stream}
          label={r.name}
          className="h-16 w-[5.5rem] shrink-0 sm:h-28 sm:w-36"
        />
      ))}
    </div>
  );
}

export function videoActive(
  cameraOn: boolean,
  wantsVideo: boolean,
  remotes: { stream: MediaStream }[],
): boolean {
  if (wantsVideo || cameraOn) return true;
  return remotes.some((r) => r.stream.getVideoTracks().some((t) => t.readyState === 'live'));
}

/**
 * Landscape phone: vertical video column for one side of the felt.
 * Left rail holds local cam + first half of remotes; right holds the rest.
 */
export function VideoSideRail({
  side,
  localStream,
  localName,
  cameraOn,
  remotes,
}: {
  side: 'left' | 'right';
  localStream: MediaStream | null;
  localName: string;
  cameraOn: boolean;
  remotes: { userId: string; name: string; stream: MediaStream }[];
}) {
  const { left, right } = useMemo(() => {
    const mid = Math.ceil(remotes.length / 2);
    return { left: remotes.slice(0, mid), right: remotes.slice(mid) };
  }, [remotes]);

  const tiles =
    side === 'left'
      ? [
          {
            key: 'local',
            stream: cameraOn ? localStream : null,
            label: 'You',
            muted: true,
            mirror: true,
          },
          ...left.map((r) => ({
            key: r.userId,
            stream: r.stream as MediaStream | null,
            label: r.name,
            muted: false,
            mirror: false,
          })),
        ]
      : right.length > 0
        ? right.map((r) => ({
            key: r.userId,
            stream: r.stream as MediaStream | null,
            label: r.name,
            muted: false,
            mirror: false,
          }))
        : [
            {
              key: 'placeholder',
              stream: null as MediaStream | null,
              label: localName,
              muted: true,
              mirror: false,
            },
          ];

  return (
    <aside
      className={`flex h-full w-[4.85rem] shrink-0 flex-col gap-1 py-0.5 ${
        side === 'left' ? 'pl-0.5' : 'pr-0.5'
      }`}
    >
      {tiles.map((t) => (
        <VideoTile
          key={t.key}
          stream={t.stream}
          label={t.label}
          muted={t.muted}
          mirror={t.mirror}
          className="min-h-0 flex-1 w-full"
        />
      ))}
    </aside>
  );
}
