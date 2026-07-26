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
  const w = small ? 'w-11 h-[4.1rem]' : 'w-16 h-24';
  const radius = small ? 'rounded-lg' : 'rounded-xl';

  if (faceDown || !code) {
    return (
      <motion.div
        initial={{ rotateY: 88, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
        className={`${w} ${radius} relative overflow-hidden border border-[#c9a227]/55 shadow-[0_8px_20px_rgba(0,0,0,0.45)]`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a6e] via-[#0d2244] to-[#071225]" />
        <div
          className="absolute inset-[3px] rounded-[inherit] opacity-70"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(201,162,39,0.22) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(201,162,39,0.12) 0 2px, transparent 2px 7px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gold/50 font-display text-lg tracking-widest">F</span>
        </div>
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[inherit]" />
      </motion.div>
    );
  }

  const rank = code[0]!;
  const suit = code[1]!;
  const red = RED.has(suit);
  const accent = red ? 'text-[#c41e3a]' : 'text-[#0c0a08]';

  return (
    <motion.div
      initial={{ y: -36, opacity: 0, rotateZ: -8 }}
      animate={{ y: 0, opacity: 1, rotateZ: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`${w} ${radius} relative bg-gradient-to-b from-[#fffaf0] to-[#efe6d4] text-ink shadow-[0_10px_24px_rgba(0,0,0,0.4)] border border-black/10 flex flex-col justify-between p-1.5 overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_20%,#c9a227,transparent_55%)]" />
      <div className={`relative z-[1] leading-none ${accent}`}>
        <div className={`font-bold ${small ? 'text-xs' : 'text-sm'}`}>{rank}</div>
        <div className={small ? 'text-[10px] -mt-0.5' : 'text-xs -mt-0.5'}>{SUIT_GLYPH[suit]}</div>
      </div>
      <div className={`relative z-[1] text-center ${accent} ${small ? 'text-2xl' : 'text-3xl'} drop-shadow-sm`}>
        {SUIT_GLYPH[suit]}
      </div>
      <div className={`relative z-[1] leading-none rotate-180 self-end ${accent}`}>
        <div className={`font-bold ${small ? 'text-xs' : 'text-sm'}`}>{rank}</div>
        <div className={small ? 'text-[10px] -mt-0.5' : 'text-xs -mt-0.5'}>{SUIT_GLYPH[suit]}</div>
      </div>
    </motion.div>
  );
}
