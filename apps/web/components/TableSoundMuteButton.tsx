'use client';

import { Button } from '@/components/ui/Button';
import { useSfxMuted } from '@/lib/useSfxMuted';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5A1.5 1.5 0 0 1 3 13V11a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M15.2 9.2 20 14m0-4.8-4.8 4.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M15.4 9.2a4.2 4.2 0 0 1 0 5.6M17.8 7a7.2 7.2 0 0 1 0 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** Mute / unmute table SFX from play chrome. */
export function TableSoundMuteButton() {
  const { muted, setMuted } = useSfxMuted();
  return (
    <Button
      type="button"
      variant="chrome"
      size="icon"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute table sounds' : 'Mute table sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      onClick={() => setMuted(!muted)}
    >
      <SpeakerIcon muted={muted} />
    </Button>
  );
}
