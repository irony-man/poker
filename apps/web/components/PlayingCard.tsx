'use client';

import { motion } from 'framer-motion';

const SUIT_GLYPH: Record<string, string> = {
  c: '♣',
  d: '♦',
  h: '♥',
  s: '♠',
};

const RED = new Set(['h', 'd']);

export function PlayingCard({
  code,
  faceDown = false,
  small = false,
}: {
  code?: string;
  faceDown?: boolean;
  small?: boolean;
}) {
  const w = small ? 'w-10 h-14' : 'w-14 h-[5.25rem]';
  if (faceDown || !code) {
    return (
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        className={`${w} rounded-md border border-gold/40 bg-gradient-to-br from-[#1e3a5f] to-[#0b1c33] shadow-md`}
      >
        <div className="h-full w-full rounded-md opacity-40 bg-[repeating-linear-gradient(45deg,#c9a22733_0_2px,transparent_2px_8px)]" />
      </motion.div>
    );
  }

  const rank = code[0]!;
  const suit = code[1]!;
  const red = RED.has(suit);

  return (
    <motion.div
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`${w} rounded-md bg-cream text-ink shadow-lg border border-black/10 flex flex-col justify-between p-1`}
    >
      <div className={`text-sm font-bold leading-none ${red ? 'text-red-700' : 'text-ink'}`}>
        {rank}
        <span className="ml-0.5">{SUIT_GLYPH[suit]}</span>
      </div>
      <div className={`text-center text-xl ${red ? 'text-red-700' : 'text-ink'}`}>
        {SUIT_GLYPH[suit]}
      </div>
      <div
        className={`text-sm font-bold leading-none rotate-180 self-end ${red ? 'text-red-700' : 'text-ink'}`}
      >
        {rank}
        <span className="ml-0.5">{SUIT_GLYPH[suit]}</span>
      </div>
    </motion.div>
  );
}
