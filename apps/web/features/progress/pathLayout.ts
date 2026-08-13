export const NODE_SPACING = 92;
export const TOP_PAD = 150;
export const BOTTOM_PAD = 220;
export const NODE_SIZE = 86;

export type NodePos = {
  level: number;
  x: number;
  y: number;
};

export function mapHeight(nodeCount: number): number {
  return TOP_PAD + Math.max(0, nodeCount - 1) * NODE_SPACING + BOTTOM_PAD;
}

/** Zigzag from top-center toward the bottom-right, then back left. */
export function zigzagPositions(startLevel: number, endLevel: number, width: number): NodePos[] {
  const center = width / 2;
  const amp = Math.min(118, Math.max(72, width * 0.3));
  const positions: NodePos[] = [];
  for (let level = startLevel; level <= endLevel; level++) {
    const i = level - startLevel;
    const wave = Math.sin(i * 0.82 + 0.55);
    positions.push({
      level,
      x: center + wave * amp,
      y: TOP_PAD + i * NODE_SPACING,
    });
  }
  return positions;
}
