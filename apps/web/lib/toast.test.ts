import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DEFAULT_MS, TOAST_EXIT_MS, TOAST_VISIBLE_CAP, toast, useToasts } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToasts.getState().clear();
  });

  afterEach(() => {
    useToasts.getState().clear();
    vi.useRealTimers();
  });

  it('pushes toasts of each kind', () => {
    toast.error('Boom');
    toast.success('Saved');
    toast.info('Heads up');
    expect(useToasts.getState().items.map((t) => [t.kind, t.message])).toEqual([
      ['error', 'Boom'],
      ['success', 'Saved'],
      ['info', 'Heads up'],
    ]);
  });

  it('ignores blank messages', () => {
    toast.error('   ');
    expect(useToasts.getState().items).toHaveLength(0);
  });

  it('refreshes a duplicate instead of stacking it', () => {
    const first = toast.error('Seat taken');
    const shownAt = useToasts.getState().items[0].shownAt;
    vi.advanceTimersByTime(1_000);
    const second = toast.error('Seat taken');
    const items = useToasts.getState().items;
    expect(second).toBe(first);
    expect(items).toHaveLength(1);
    expect(items[0].shownAt).toBeGreaterThan(shownAt);
  });

  it('keeps same text with a different kind as separate toasts', () => {
    toast.error('Done');
    toast.success('Done');
    expect(useToasts.getState().items).toHaveLength(2);
  });

  it('caps visible toasts, dropping the oldest', () => {
    for (let i = 0; i < TOAST_VISIBLE_CAP + 2; i++) toast.info(`msg ${i}`);
    const items = useToasts.getState().items;
    expect(items).toHaveLength(TOAST_VISIBLE_CAP);
    expect(items[0].message).toBe('msg 2');
  });

  it('dismiss marks leaving then removes after the exit animation', () => {
    const id = toast.success('Bye');
    toast.dismiss(id);
    expect(useToasts.getState().items[0].leaving).toBe(true);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(useToasts.getState().items).toHaveLength(0);
  });

  it('auto-dismisses after its duration', () => {
    toast.info('Timed');
    vi.advanceTimersByTime(TOAST_DEFAULT_MS);
    expect(useToasts.getState().items).toHaveLength(0);
  });
});
