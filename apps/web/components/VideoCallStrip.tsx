'use client';

import { useEffect, useRef } from 'react';

function VideoTile({
  stream,
  label,
  muted = false,
  mirror = false,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
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
    <div className="relative h-24 w-[7.5rem] shrink-0 overflow-hidden rounded-lg border border-cream/20 bg-ink sm:h-28 sm:w-36">
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
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised text-[10px] uppercase tracking-wider text-cream/40">
          No cam
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-cream">
        {label}
      </span>
    </div>
  );
}

/** Compact strip of local + remote video tiles while in an AV call. */
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
  const remotesHaveVideo = remotes.some((r) =>
    r.stream.getVideoTracks().some((t) => t.readyState === 'live'),
  );
  if (!wantsVideo && !cameraOn && !remotesHaveVideo) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
      <VideoTile
        stream={cameraOn ? localStream : null}
        label={`${localName} (you)`}
        muted
        mirror
      />
      {remotes.map((r) => (
        <VideoTile key={r.userId} stream={r.stream} label={r.name} />
      ))}
    </div>
  );
}
