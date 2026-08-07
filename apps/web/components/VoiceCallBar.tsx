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

  const btn = compact ? 'btn-ghost text-[10px] py-1 px-2' : 'btn-ghost text-xs py-1.5 px-3';

  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
      {!inVoice ? (
        <button
          type="button"
          onClick={() => void onJoinVoice()}
          disabled={state === 'joining'}
          className={`${btn} border-mushroom/30 text-mushroom hover:bg-mushroom/10`}
          title="Join table voice chat"
        >
          {state === 'joining' ? '…' : compact ? 'Mic' : 'Voice'}
        </button>
      ) : (
        <>
          {!compact && (
            <span className="status-chip border-mushroom/30 bg-mushroom/10 text-mushroom">
              <span className="h-1.5 w-1.5 rounded-full bg-positive animate-live-blink" />
              Voice · {peerLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className={
              muted
                ? `rounded-full border border-cream/25 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-cream/70 hover:bg-cream/10`
                : `rounded-full border border-mushroom/40 bg-mushroom/15 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px]'} text-mushroom`
            }
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? 'Unmute' : compact ? 'Mic' : 'Mic on'}
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
