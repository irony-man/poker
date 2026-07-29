'use client';

export function VoiceCallBar({
  inVoice,
  state,
  muted,
  peers,
  error,
  onJoin,
  onLeave,
  onToggleMute,
}: {
  inVoice: boolean;
  state: 'idle' | 'joining' | 'connected' | 'error';
  muted: boolean;
  peers: { userId: string; name: string }[];
  error: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}) {
  const peerLabel =
    peers.length === 0
      ? 'No one else yet'
      : peers.length === 1
        ? peers[0]!.name
        : `${peers.length} players`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!inVoice ? (
        <button
          type="button"
          onClick={() => void onJoin()}
          disabled={state === 'joining'}
          className="btn-ghost text-xs py-1.5 px-3 border-felt-neon/30 text-felt-neon hover:bg-felt-neon/10"
          title="Join table voice chat"
        >
          {state === 'joining' ? 'Connecting…' : '🎙 Voice'}
        </button>
      ) : (
        <>
          <span className="status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon">
            <span className="h-1.5 w-1.5 rounded-full bg-felt-neon animate-live-blink" />
            Voice · {peerLabel}
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            className={
              muted
                ? 'rounded-full border border-cream/25 px-2.5 py-1.5 text-[10px] text-cream/70 hover:bg-cream/10'
                : 'rounded-full border border-felt-neon/40 bg-felt-neon/15 px-2.5 py-1.5 text-[10px] text-felt-neon'
            }
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? 'Unmute' : 'Mic on'}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-full px-2.5 py-1.5 text-[10px] text-cream/45 hover:text-red-300"
          >
            Leave voice
          </button>
        </>
      )}
      {error && (
        <span className="text-[10px] text-red-300" title={error}>
          Mic error
        </span>
      )}
    </div>
  );
}
