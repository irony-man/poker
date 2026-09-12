'use client';

import { LudoWinModal } from '@/components/ludo/LudoWinModal';
import type { ReadyRosterPlayer } from '@/components/WinHandModal';

export function SnakesWinModal({
  winnerName,
  winnerSeat,
  youWon,
  canReady,
  isReady,
  readyPlayers,
  readyCount,
  readyTotal,
  onReady,
  onDismiss,
}: {
  winnerName: string;
  winnerSeat: number;
  youWon: boolean;
  canReady: boolean;
  isReady: boolean;
  readyPlayers: ReadyRosterPlayer[];
  readyCount: number;
  readyTotal: number;
  onReady: () => void;
  onDismiss: () => void;
}) {
  return (
    <LudoWinModal
      winnerName={winnerName}
      winnerSeat={winnerSeat}
      youWon={youWon}
      canReady={canReady}
      isReady={isReady}
      readyPlayers={readyPlayers}
      readyCount={readyCount}
      readyTotal={readyTotal}
      onReady={onReady}
      onDismiss={onDismiss}
      subtitle="First to 100"
      detail="Climb ladders, dodge snakes. Ready up for a rematch."
      titleId="snakes-win-title"
    />
  );
}
