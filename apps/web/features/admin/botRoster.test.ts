import { describe, expect, it } from 'vitest';
import type { BotGroup } from '@/lib/api';
import {
  applyBotGroupsImport,
  parseBotGroupsJson,
  serializeBotGroupsJson,
} from './botRoster';

const classic: BotGroup = {
  id: 'classic',
  name: 'Classic',
  names: ['AceBot', 'FoldBot'],
  isDefault: true,
  defaultPersonality: null,
  namePersonalities: { AceBot: 'aggro', FoldBot: 'nit' },
};

describe('parseBotGroupsJson', () => {
  it('parses an array of groups', () => {
    const res = parseBotGroupsJson(
      JSON.stringify([
        {
          id: 'tight-table',
          name: 'Tight Table',
          isDefault: false,
          defaultPersonality: null,
          names: ['StoneWall', 'LockBox'],
          namePersonalities: { StoneWall: 'nit', LockBox: 'tight' },
        },
      ]),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0]!.id).toBe('tight-table');
    expect(res.groups[0]!.namePersonalities.StoneWall).toBe('nit');
    expect(res.groups[0]!.isDefault).toBe(false);
  });

  it('accepts { groups: [...] } and a single object', () => {
    const wrapped = parseBotGroupsJson(
      JSON.stringify({
        groups: [
          {
            id: 'a',
            name: 'A',
            names: ['BotA'],
            namePersonalities: {},
          },
        ],
      }),
    );
    expect(wrapped.ok).toBe(true);

    const single = parseBotGroupsJson(
      JSON.stringify({
        id: 'b',
        name: 'B',
        names: ['BotB'],
        defaultPersonality: 'maniac',
      }),
    );
    expect(single.ok).toBe(true);
    if (!single.ok) return;
    expect(single.groups[0]!.defaultPersonality).toBe('maniac');
  });

  it('rejects invalid JSON and bad personalities', () => {
    expect(parseBotGroupsJson('{nope').ok).toBe(false);
    const bad = parseBotGroupsJson(
      JSON.stringify([{ id: 'x', name: 'X', names: ['A'], namePersonalities: { A: 'yolo' } }]),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors[0]).toMatch(/unknown personality/i);
  });

  it('rejects empty names and duplicate ids', () => {
    expect(
      parseBotGroupsJson(JSON.stringify([{ id: 'x', name: 'X', names: [] }])).ok,
    ).toBe(false);
    const dup = parseBotGroupsJson(
      JSON.stringify([
        { id: 'same', name: 'One', names: ['A'] },
        { id: 'same', name: 'Two', names: ['B'] },
      ]),
    );
    expect(dup.ok).toBe(false);
  });
});

describe('applyBotGroupsImport', () => {
  it('merges by id and appends new groups', () => {
    const imported: BotGroup[] = [
      {
        id: 'classic',
        name: 'Classic Updated',
        names: ['AceBot'],
        isDefault: true,
        defaultPersonality: null,
        namePersonalities: { AceBot: 'balanced' },
      },
      {
        id: 'chaos-crew',
        name: 'Chaos Crew',
        names: ['AllInAnnie'],
        isDefault: false,
        defaultPersonality: 'maniac',
        namePersonalities: {},
      },
    ];
    const res = applyBotGroupsImport([classic], imported, 'merge');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.replaced).toBe(1);
    expect(res.added).toBe(1);
    expect(res.groups).toHaveLength(2);
    expect(res.groups[0]!.name).toBe('Classic Updated');
    expect(res.groups[0]!.isDefault).toBe(true);
    expect(res.groups[1]!.id).toBe('chaos-crew');
  });

  it('keeps existing default when merge import omits isDefault', () => {
    const imported: BotGroup[] = [
      {
        id: 'chaos-crew',
        name: 'Chaos Crew',
        names: ['AllInAnnie'],
        isDefault: false,
        defaultPersonality: 'maniac',
        namePersonalities: {},
      },
    ];
    const res = applyBotGroupsImport([classic], imported, 'merge');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.groups.find((g) => g.id === 'classic')?.isDefault).toBe(true);
    expect(res.groups.find((g) => g.id === 'chaos-crew')?.isDefault).toBe(false);
  });

  it('replaces the full list', () => {
    const imported: BotGroup[] = [
      {
        id: 'soft-school',
        name: 'Soft School',
        names: ['CallCart'],
        isDefault: true,
        defaultPersonality: 'passive',
        namePersonalities: { CallCart: 'caller' },
      },
    ];
    const res = applyBotGroupsImport([classic], imported, 'replace');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0]!.id).toBe('soft-school');
  });
});

describe('serializeBotGroupsJson', () => {
  it('round-trips through parse', () => {
    const text = serializeBotGroupsJson([classic]);
    const res = parseBotGroupsJson(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.groups[0]!.id).toBe('classic');
    expect(res.groups[0]!.namePersonalities.AceBot).toBe('aggro');
  });
});
