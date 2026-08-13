export const CHAPTER_SIZE = 10;

export type NodeStatus = 'completed' | 'current' | 'locked';

export function chapterProgress(handsPlayed: number) {
  const level = Math.max(0, Math.floor(handsPlayed));
  const inChapter = level % CHAPTER_SIZE;
  const nextMilestone = level + 1;
  const fill = (inChapter / CHAPTER_SIZE) * 100;
  return { level, nextMilestone, fill, inChapter };
}

export function nodeWindow(level: number): { start: number; end: number } {
  const current = Math.max(1, level);
  const start = Math.max(1, current - 12);
  const end = Math.max(start + 15, current + 4);
  return { start, end };
}

export function nodeStatus(nodeLevel: number, handsPlayed: number): NodeStatus {
  if (handsPlayed <= 0) return nodeLevel === 1 ? 'current' : 'locked';
  if (nodeLevel < handsPlayed) return 'completed';
  if (nodeLevel === handsPlayed) return 'current';
  return 'locked';
}

export type NodeBadgeKind = 'chip' | 'spade' | 'heart' | 'plus';

export function badgeForNode(
  nodeLevel: number,
  handsPlayed: number,
  status: NodeStatus,
): NodeBadgeKind | null {
  if (status === 'locked') return null;
  if (status === 'current') return 'chip';
  const behind = handsPlayed - nodeLevel;
  if (behind === 1) return 'spade';
  if (behind === 2) return 'heart';
  if (behind === 3) return 'plus';
  return null;
}
