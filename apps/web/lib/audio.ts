'use client';

/** Soft UI ticks via Web Audio (no asset files). */
export function playTick(kind: 'deal' | 'action' | 'win' | 'error' = 'action') {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const freqs = { deal: 440, action: 330, win: 660, error: 180 } as const;
    osc.frequency.value = freqs[kind];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
    void ctx.close();
  } catch {
    /* ignore autoplay restrictions */
  }
}
