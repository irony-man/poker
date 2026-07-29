'use client';

export function VoiceCallBar({
  inVoice,
  state,
  muted,
  cameraOn,
  wantsVideo,
  peers,
  error,
  onJoinVoice,
  onJoinVideo,
  onLeave,
  onToggleMute,
  onToggleCamera,
  compact = false,
}: {
  inVoice: boolean;
  state: 'idle' | 'joining' | 'connected' | 'error';
  muted: boolean;
  cameraOn: boolean;
  wantsVideo: boolean;
  peers: { userId: string; name: string }[];
  error: string | null;
  onJoinVoice: () => void;
  onJoinVideo: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  compact?: boolean;
}) {
  const peerLabel =
    peers.length === 0
      ? 'No one else yet'
      : peers.length === 1
        ? peers[0]!.name
        : `${peers.length} players`;

  const btn = compact ? 'btn-ghost text-[10px] py-1 px-2' : 'btn-ghost text-xs py-1.5 px-3';
  const modeLabel = wantsVideo || cameraOn ? 'Video' : 'Voice';

  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
      {!inVoice ? (
        <>
          <button
            type="button"
            onClick={() => void onJoinVoice()}
            disabled={state === 'joining'}
            className={`${btn} border-felt-neon/30 text-felt-neon hover:bg-felt-neon/10`}
            title="Join table voice chat"
          >
            {state === 'joining' ? '…' : compact ? 'Mic' : 'Voice'}
          </button>
          <button
            type="button"
            onClick={() => void onJoinVideo()}
            disabled={state === 'joining'}
            className={`${btn} border-cyan/35 text-cyan hover:bg-cyan/10`}
            title="Join with camera + mic"
          >
            {compact ? 'Cam' : 'Video'}
          </button>
        </>
      ) : (
        <>
          {!compact && (
            <span className="status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-felt-neon animate-live-blink" />
              {modeLabel} · {peerLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className={
              muted
                ? `rounded-full border border-cream/25 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-cream/70 hover:bg-cream/10`
                : `rounded-full border border-felt-neon/40 bg-felt-neon/15 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-felt-neon`
            }
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? 'Unmute' : compact ? 'Mic' : 'Mic on'}
          </button>
          <button
            type="button"
            onClick={() => void onToggleCamera()}
            className={
              cameraOn
                ? `rounded-full border border-cyan/40 bg-cyan/15 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-cyan`
                : `rounded-full border border-cream/25 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-cream/70 hover:bg-cream/10`
            }
            title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {cameraOn ? (compact ? 'Cam' : 'Cam on') : compact ? 'Cam' : 'Cam off'}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className={`rounded-full ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-cream/45 hover:text-red-300`}
          >
            {compact ? '×' : 'Leave call'}
          </button>
        </>
      )}
      {error && (
        <span className="text-[10px] text-red-300" title={error}>
          Media error
        </span>
      )}
    </div>
  );
}
