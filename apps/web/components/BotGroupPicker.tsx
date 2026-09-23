'use client';

import { partitionBotGroupsByLabel, resolveBotGroupLabelId } from '@poker/engine';
import { ChoiceRow } from '@/components/ChoiceRow';
import type { BotGroupLabels, PublicBotGroup } from '@/lib/api';
import { DEFAULT_BOT_GROUP_LABELS } from '@/lib/api';

function chipRow(
  label: string,
  name: string,
  options: string[],
  selectedId: string,
  onSelect: (id: string) => void,
  disabled: boolean | undefined,
  formatName: (id: string) => string,
) {
  if (options.length === 0) return null;
  return (
    <ChoiceRow
      label={label}
      name={name}
      selected={selectedId}
      options={options}
      onSelect={onSelect}
      disabled={disabled}
      format={formatName}
    />
  );
}

/** Dynamic label rows with one shared selection. Labels come from admin. */
export function BotGroupPicker({
  groups,
  selectedId,
  onSelect,
  name,
  disabled,
  labels,
}: {
  groups: PublicBotGroup[];
  selectedId: string;
  onSelect: (id: string) => void;
  name: string;
  disabled?: boolean;
  labels?: BotGroupLabels | null;
}) {
  if (groups.length === 0) return null;

  const labelRows =
    labels && labels.length > 0 ? labels : [...DEFAULT_BOT_GROUP_LABELS];

  const withLabel = groups.map((g) => ({
    ...g,
    labelId: resolveBotGroupLabelId(g.id, g.name, g.labelId, g.kind),
  }));
  const rows = partitionBotGroupsByLabel(withLabel, labelRows);

  const formatName = (id: string) => {
    const g = groups.find((x) => x.id === id);
    return g?.name ?? id;
  };

  const selected = groups.find((g) => g.id === selectedId);
  const selectedHelp = selected?.description?.trim() || null;

  const nonEmpty = rows.filter((r) => r.groups.length > 0);
  if (nonEmpty.length === 0) {
    return chipRow(
      labelRows[0]?.name ?? 'Groups',
      name,
      groups.map((g) => g.id),
      selectedId,
      onSelect,
      disabled,
      formatName,
    );
  }

  if (nonEmpty.length === 1) {
    const only = nonEmpty[0]!;
    return (
      <div>
        {chipRow(
          only.label.name,
          name,
          only.groups.map((g) => g.id),
          selectedId,
          onSelect,
          disabled,
          formatName,
        )}
        {selectedHelp ? <p className="field-help mt-2.5">{selectedHelp}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {nonEmpty.map((row) => {
        const containsSelected = row.groups.some((g) => g.id === selectedId);
        return (
          <div key={row.label.id}>
            {chipRow(
              row.label.name,
              `${name}-${row.label.id}`,
              row.groups.map((g) => g.id),
              selectedId,
              onSelect,
              disabled,
              formatName,
            )}
            {containsSelected && selectedHelp ? (
              <p className="field-help mt-2.5">{selectedHelp}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
