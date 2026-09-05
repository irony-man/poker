'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TextField } from '@/components/ui/TextField';
import { createLudo } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

const SEAT_OPTIONS = [2, 3, 4] as const;

export default function LudoHostPage() {
  const router = useRouter();
  const { authReady, signedIn, sessionToken, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('ludo');
  const [maxSeats, setMaxSeats] = useState(4);
  const [botCount, setBotCount] = useState(0);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBots = Math.max(0, maxSeats - 1);
  const maxFriendInvites = Math.min(8, Math.max(0, maxSeats - botCount - 1));
  const codePreview = customRoomCode.trim();
  const moreSummary =
    `${botCount === 0 ? 'No bots' : `${botCount} bot${botCount === 1 ? '' : 's'}`}` +
    ` · ${codePreview ? `code ${codePreview}` : 'auto code'}`;

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount, maxBots]);

  useEffect(() => {
    if (inviteFriendIds.length > maxFriendInvites) {
      setInviteFriendIds((ids) => ids.slice(0, maxFriendInvites));
    }
  }, [maxFriendInvites, inviteFriendIds.length]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    enterMobileFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const code = customRoomCode.trim();
      if (code && !/^\d{4,8}$/.test(code)) {
        setError('Room code must be 4–8 digits');
        setBusy(false);
        return;
      }
      const board = await createLudo(
        {
          name: `${session.name}'s Ludo`,
          maxSeats,
          botCount,
          ...(code ? { inviteCode: code } : {}),
          inviteFriendIds,
        },
        session.sessionToken,
      );
      router.push(`/ludo/${board.ludoId}?invite=${board.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      error={error}
    >
      <form onSubmit={onCreate}>
        <LobbySplitCard
          imageSrc={resolvePublicImage(pageCopy.image ?? '/home-offline.png')}
          imageAlt={pageCopy.imageAlt ?? 'Host a Ludo side quest with no stakes'}
        >
          <ChoiceRow
            label="Seats"
            name="ludo-seats"
            selected={maxSeats}
            options={SEAT_OPTIONS}
            onSelect={setMaxSeats}
          />

          <CollapsibleSection title="Bots & room code" summary={moreSummary}>
            <ChoiceRow
              label="Starting bots"
              name="ludo-bots"
              selected={botCount}
              options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
              onSelect={setBotCount}
              format={(n) => (n === 0 ? 'None' : String(n))}
            />
            <TextField
              variant="hud"
              label="Room code (optional)"
              value={customRoomCode}
              onChange={(e) => setCustomRoomCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="font-mono tracking-[0.2em]"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              autoComplete="off"
              help="Leave blank to auto-generate, or enter 4–8 digits"
            />
          </CollapsibleSection>

          <FriendInvitePicker
            sessionToken={sessionToken}
            selectedIds={inviteFriendIds}
            onChange={setInviteFriendIds}
            disabled={busy}
            maxSelect={Math.max(0, maxFriendInvites)}
            title="Invite friends"
            help={
              maxFriendInvites === 0
                ? 'Free a seat (reduce bots) to invite friends.'
                : 'They get a Ludo invite in Friends. Optional — share the room code too.'
            }
          />

          <Button disabled={busy} type="submit" className="mt-1 min-h-11 w-full">
            {busy
              ? 'Creating…'
              : inviteFriendIds.length > 0
                ? `Create board · invite ${inviteFriendIds.length}`
                : 'Create Ludo board'}
          </Button>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
