'use client';

export function VoiceCallBar({
  inVoice,
  state,
  muted,
  peers,
  error,
  onJoinVoice,
  onLeave,
  onToggleMute,
  compact = false,
}: {
  inVoice: boolean;
  state: 'idle' | 'joining' | 'connected' | 'error';
  muted: boolean;
  peers: { userId: string; name: string }[];
  error: string | null;
  onJoinVoice: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  compact?: boolean;
}) {
  const peerLabel =
    peers.length === 0
      ? 'No one else yet'
      : peers.length === 1
        ? peers[0]!.name
        : `${peers.length} players`;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {!inVoice ? (
        <button
          type="button"
          onClick={() => void onJoinVoice()}
          disabled={state === 'joining'}
          className="play-chrome-control disabled:opacity-50"
          title="Join table voice chat"
        >
          {state === 'joining' ? 'Connecting…' : compact ? 'Mic' : 'Voice'}
        </button>
      ) : (
        <>
          {!compact && (
            <span
              className="play-chrome-control max-w-[11rem] cursor-default gap-1.5 border-positive/25 bg-positive/10 text-sidebar hover:border-positive/25 hover:bg-positive/10"
              title={`Voice · ${peerLabel}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive animate-live-blink" />
              <span className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.08em]">
                Voice · {peerLabel}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className={muted ? 'play-chrome-control' : 'play-chrome-control play-chrome-control-active'}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? 'Unmute' : compact ? 'Mic' : 'Mic on'}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="play-chrome-control border-danger/25 text-danger hover:border-danger/40 hover:bg-danger/10"
            title="Leave voice call"
          >
            {compact ? '×' : 'Leave call'}
          </button>
        </>
      )}
      {error && (
        <span className="px-1 text-[10px] font-medium text-danger" title={error}>
          Mic error
        </span>
      )}
    </div>
  );
}
