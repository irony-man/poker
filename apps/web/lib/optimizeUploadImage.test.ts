import { describe, expect, it } from 'vitest';

/** Mirror private sizing logic for unit tests. */
function targetSize(
  width: number,
  height: number,
  maxEdge: number,
  squareCrop: boolean,
): { w: number; h: number } {
  if (squareCrop) {
    const side = Math.min(width, height);
    const out = Math.min(maxEdge, side);
    return { w: out, h: out };
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

describe('optimizeUploadImage sizing', () => {
  it('square-crops avatars to max edge', () => {
    expect(targetSize(3000, 2000, 512, true)).toEqual({ w: 512, h: 512 });
  });

  it('contains site images within max edge', () => {
    expect(targetSize(4000, 3000, 1920, false)).toEqual({ w: 1920, h: 1440 });
  });

  it('does not upscale small images', () => {
    expect(targetSize(200, 100, 1920, false)).toEqual({ w: 200, h: 100 });
  });
});
