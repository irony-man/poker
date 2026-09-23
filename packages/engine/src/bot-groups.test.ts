import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOT_GROUP_DEFS,
  DEFAULT_BOT_GROUP_LABEL_DEFS,
  partitionBotGroupsByLabel,
  resolveBotGroupLabelId,
} from './bot-groups.js';

describe('resolveBotGroupLabelId', () => {
  it('prefers explicit labelId', () => {
    expect(resolveBotGroupLabelId('x', 'Y', 'movies', 'level')).toBe('movies');
  });

  it('maps legacy kind style → groups', () => {
    expect(resolveBotGroupLabelId('x', 'Y', null, 'style')).toBe('groups');
    expect(resolveBotGroupLabelId('x', 'Y', null, 'level')).toBe('level');
    expect(resolveBotGroupLabelId('x', 'Y', null, 'movies')).toBe('movies');
  });

  it('infers Easy/Medium/Hard from id or name', () => {
    expect(resolveBotGroupLabelId('easy', 'Soft', null, null)).toBe('level');
    expect(resolveBotGroupLabelId('custom', 'Medium', undefined, undefined)).toBe('level');
    expect(resolveBotGroupLabelId('hard', 'Hard', '', '')).toBe('level');
  });

  it('defaults everything else to groups', () => {
    expect(resolveBotGroupLabelId('tight-table', 'Tight Table', null, null)).toBe('groups');
    expect(resolveBotGroupLabelId('classic', 'Classic', null, null)).toBe('groups');
  });
});

describe('partitionBotGroupsByLabel', () => {
  it('splits packs into ordered label rows', () => {
    const rows = partitionBotGroupsByLabel(
      [
        { id: 'easy', name: 'Easy', labelId: 'level' },
        { id: 'tight-table', name: 'Tight Table' },
        { id: 'medium', name: 'Medium' },
        { id: 'rounders', name: 'Rounders', kind: 'movies' },
      ],
      DEFAULT_BOT_GROUP_LABEL_DEFS,
    );
    expect(rows.map((r) => r.label.id)).toEqual(['level', 'groups', 'movies']);
    expect(rows[0]!.groups.map((g) => g.id)).toEqual(['easy', 'medium']);
    expect(rows[1]!.groups.map((g) => g.id)).toEqual(['tight-table']);
    expect(rows[2]!.groups.map((g) => g.id)).toEqual(['rounders']);
  });

  it('respects custom label lists', () => {
    const rows = partitionBotGroupsByLabel(
      [
        { id: 'a', name: 'A', labelId: 'fantasy' },
        { id: 'b', name: 'B', labelId: 'level' },
      ],
      [
        { id: 'level', name: 'Level' },
        { id: 'fantasy', name: 'Fantasy' },
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]!.groups.map((g) => g.id)).toEqual(['a']);
  });
});

describe('DEFAULT_BOT_GROUP_DEFS', () => {
  it('ships Easy/Medium/Hard with Medium as default', () => {
    const ids = DEFAULT_BOT_GROUP_DEFS.map((g) => g.id);
    expect(ids).toContain('easy');
    expect(ids).toContain('medium');
    expect(ids).toContain('hard');
    expect(DEFAULT_BOT_GROUP_DEFS.filter((g) => g.isDefault)).toHaveLength(1);
    expect(DEFAULT_BOT_GROUP_DEFS.find((g) => g.isDefault)?.id).toBe('medium');
  });

  it('marks levels and styles correctly with personalities', () => {
    const levels = DEFAULT_BOT_GROUP_DEFS.filter((g) => g.labelId === 'level');
    const styles = DEFAULT_BOT_GROUP_DEFS.filter((g) => g.labelId === 'groups');
    expect(levels).toHaveLength(3);
    expect(styles.length).toBeGreaterThanOrEqual(5);
    for (const g of DEFAULT_BOT_GROUP_DEFS) {
      expect(g.names.length).toBeGreaterThan(0);
      expect(Object.keys(g.namePersonalities).length).toBeGreaterThan(0);
      expect(typeof g.description).toBe('string');
    }
  });
});
