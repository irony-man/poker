'use client';

import { Button, buttonClass } from '@/components/ui/Button';

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
        <Button
          type="button"
          variant="chrome"
          onClick={() => void onJoinVoice()}
          disabled={state === 'joining'}
          className="disabled:opacity-50"
          title="Join table voice chat"
        >
          {state === 'joining' ? 'Connecting…' : compact ? 'Mic' : 'Voice'}
        </Button>
      ) : (
        <>
          {!compact && (
            <span
              className={buttonClass(
                'chrome',
                'md',
                'max-w-[11rem] cursor-default gap-1.5 border-positive/25 bg-positive/10 text-sidebar hover:border-positive/25 hover:bg-positive/10',
              )}
              title={`Voice · ${peerLabel}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive animate-live-blink" />
              <span className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.08em]">
                Voice · {peerLabel}
              </span>
            </span>
          )}
          <Button
            type="button"
            variant={muted ? 'chrome' : 'chromeActive'}
            onClick={onToggleMute}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? 'Unmute' : compact ? 'Mic' : 'Mic on'}
          </Button>
          <Button
            type="button"
            variant="chromeDanger"
            onClick={onLeave}
            title="Leave voice call"
          >
            {compact ? '×' : 'Leave call'}
          </Button>
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
