/** Sleep that resolves early (returning `false`) when `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, Math.max(0, ms));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Start offset for VU `i` of `n` spread evenly across the ramp-up window. */
export function rampDelay(i: number, n: number, rampUpMs: number): number {
  if (n <= 1 || rampUpMs <= 0) return 0;
  return Math.floor((i / n) * rampUpMs);
}

/** `ms` ± `pct`% uniform jitter. */
export function jitter(ms: number, pct = 20): number {
  const spread = (ms * pct) / 100;
  return Math.max(0, ms + (Math.random() * 2 - 1) * spread);
}

/** Resolves when `signal` aborts. */
export function untilAborted(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
}

/** Split `items` into consecutive chunks of `size` (last chunk may be shorter). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
