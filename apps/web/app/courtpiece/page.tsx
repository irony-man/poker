'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CourtpieceRulesVariant } from '@poker/protocol';
import { ChoiceRow } from '@/components/ChoiceRow';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TextField } from '@/components/ui/TextField';
import { createCourtpiece } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

const RULE_OPTIONS: CourtpieceRulesVariant[] = ['classic', 'classic_full', 'hokm'];

function formatRule(v: CourtpieceRulesVariant): string {
  if (v === 'classic_full') return 'Classic Full';
  if (v === 'hokm') return 'Hokm';
  return 'Classic';
}

export default function CourtpieceHostPage() {
  const router = useRouter();
  const { authReady, signedIn, sessionToken, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('courtpiece');
  const [rulesVariant, setRulesVariant] = useState<CourtpieceRulesVariant>('classic');
  const [botCount, setBotCount] = useState(0);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBots = 3;
  const maxFriendInvites = Math.min(8, Math.max(0, 4 - botCount - 1));
  const codePreview = customRoomCode.trim();
  const moreSummary =
    `${botCount === 0 ? 'No bots' : `${botCount} bot${botCount === 1 ? '' : 's'}`}` +
    ` · ${codePreview ? `code ${codePreview}` : 'auto code'}`;

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [botCount, maxBots]);

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
      const board = await createCourtpiece(
        {
          name: `${session.name}'s Court Piece`,
          rulesVariant,
          botCount,
          ...(code ? { inviteCode: code } : {}),
          inviteFriendIds,
        },
        session.sessionToken,
      );
      router.push(`/courtpiece/${board.courtpieceId}?invite=${board.inviteCode}`);
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
          imageSrc={resolvePublicImage(pageCopy.image ?? '/home-offline.webp')}
          imageAlt={pageCopy.imageAlt ?? 'Host Court Piece with no stakes'}
        >
          <ChoiceRow
            label="Rules"
            name="courtpiece-rules"
            selected={rulesVariant}
            options={RULE_OPTIONS}
            onSelect={setRulesVariant}
            format={formatRule}
          />
          <p className="field-help">
            {rulesVariant === 'hokm'
              ? 'Iranian Hokm: the hakem peeks at 5 cards, picks trump, then everyone gets a full hand. Partners sit across. First team to 7 hands wins; hakem keeps the deal until their team loses a hand.'
              : rulesVariant === 'classic_full'
                ? 'Same as Classic, with bonus scoring: sweep all 13 tricks (court) or hold the losers under 4 tricks (baazi) and that hand counts as 2. First team to 7 hands wins.'
                : 'Standard Court Piece: fixed partners (N–S vs E–W), full deal, left of dealer names trump. Win the hand by taking more tricks. First team to 7 hands wins the match.'}
          </p>

          <CollapsibleSection title="Bots & room code" summary={moreSummary}>
            <ChoiceRow
              label="Starting bots"
              name="courtpiece-bots"
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
                : 'They get a Court Piece invite in Friends. Optional — share the room code too.'
            }
          />

          <Button disabled={busy} type="submit" className="mt-1 min-h-11 w-full">
            {busy
              ? 'Creating…'
              : inviteFriendIds.length > 0
                ? `Create board · invite ${inviteFriendIds.length}`
                : 'Create Court Piece board'}
          </Button>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
