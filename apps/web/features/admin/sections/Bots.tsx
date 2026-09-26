import { useMemo, useState } from 'react';
import { BOT_PERSONALITY_IDS } from '@poker/engine';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField';
import type { BotGroup, BotGroupLabels } from '@/lib/api';
import {
  DEFAULT_BOT_NAMES,
  MAX_BOT_GROUPS,
  PERSONALITY_LABELS,
  groupBulkText,
  parseBotGroupsJson,
  parseBulkBotRoster,
  type BotGroupsImportMode,
} from '../botRoster';
import { FORM_LABEL_CLASS } from '@/components/ui/TextField';
import {
  ADMIN_SAVE_BTN,
  AdminInset,
  AdminList,
  AdminListRow,
  AdminTableShell,
  DetailHeader,
  EmptyPane,
  PanelBlock,
  SaveBar,
  Section,
  SplitItem,
  SplitPane,
} from '../ui';

export function BotsSection({
  botGroups,
  labels,
  botNameDrafts,
  openBotGroup,
  botNameInput,
  showBulkEdit,
  showJsonImport,
  importJsonText,
  importMode,
  busy,
  busyKey,
  onLabels,
  onAddLabel,
  onRemoveLabel,
  onRenameLabelId,
  onSelectGroup,
  onAddGroup,
  onRemoveGroup,
  onRenameId,
  onUpdateGroup,
  onDefaultPersonality,
  onNamePersonality,
  onNameInput,
  onAddName,
  onRemoveName,
  onDraft,
  onToggleBulk,
  onToggleJsonImport,
  onImportJsonText,
  onImportMode,
  onImportJson,
  onExportJson,
  onResetDefaults,
  onSave,
}: {
  botGroups: BotGroup[];
  labels: BotGroupLabels;
  botNameDrafts: Record<string, string>;
  openBotGroup: string | null;
  botNameInput: string;
  showBulkEdit: boolean;
  showJsonImport: boolean;
  importJsonText: string;
  importMode: BotGroupsImportMode;
  busy: boolean;
  busyKey: string | null;
  onLabels: (labels: BotGroupLabels) => void;
  onAddLabel: () => void;
  onRemoveLabel: (id: string) => void;
  onRenameLabelId: (fromId: string, rawNext: string) => void;
  onSelectGroup: (id: string) => void;
  onAddGroup: () => void;
  onRemoveGroup: (id: string) => void;
  onRenameId: (fromId: string, rawNext: string) => void;
  onUpdateGroup: (id: string, patch: Partial<BotGroup>) => void;
  onDefaultPersonality: (id: string, value: string) => void;
  onNamePersonality: (groupId: string, name: string, value: string) => void;
  onNameInput: (value: string) => void;
  onAddName: (id: string, raw: string) => void;
  onRemoveName: (id: string, name: string) => void;
  onDraft: (id: string, text: string) => void;
  onToggleBulk: (group: BotGroup) => void;
  onToggleJsonImport: () => void;
  onImportJsonText: (text: string) => void;
  onImportMode: (mode: BotGroupsImportMode) => void;
  onImportJson: () => void;
  onExportJson: () => void;
  onResetDefaults: () => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const group = botGroups.find((g) => g.id === openBotGroup) ?? botGroups[0] ?? null;
  const importPreview = useMemo(
    () => (showJsonImport ? parseBotGroupsJson(importJsonText) : null),
    [showJsonImport, importJsonText],
  );

  return (
    <Section
      title="Bot groups"
      description="Name packs and playing styles hosts use when seating bots. Edit picker row labels and add, rename, or remove packs."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tabular-nums text-muted">
            {botGroups.length}/{MAX_BOT_GROUPS}
          </span>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={onExportJson}
            className="min-h-9 px-4 text-xs"
          >
            Export JSON
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={onResetDefaults}
            className="min-h-9 px-4 text-xs"
          >
            Reset to defaults
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={onToggleJsonImport}
            className="min-h-9 px-4 text-xs"
          >
            {showJsonImport ? 'Hide import' : 'Import JSON'}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || botGroups.length >= MAX_BOT_GROUPS}
            onClick={onAddGroup}
            className="min-h-9 px-4 text-xs"
          >
            Add group
          </Button>
        </div>
      }
    >
      <form onSubmit={onSave} className="space-y-4">
        <PanelBlock>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className={FORM_LABEL_CLASS}>Picker row labels</span>
              <p className="mt-0.5 text-xs text-muted">
                Each label is a chip row on host / offline. Packs pick which row via Label below.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || labels.length >= 12}
              onClick={onAddLabel}
              className="min-h-9 px-4 text-xs"
            >
              Add label
            </Button>
          </div>
          <ul className="space-y-2">
            {labels.map((label, index) => (
              <li key={label.id}>
                <AdminInset className="flex flex-wrap items-end gap-2 py-2">
                <div className="min-w-[8rem] flex-1">
                  <TextField
                    label={index === 0 ? 'Display name' : undefined}
                    value={label.name}
                    onChange={(e) =>
                      onLabels(
                        labels.map((l) =>
                          l.id === label.id ? { ...l, name: e.target.value } : l,
                        ),
                      )
                    }
                    maxLength={32}
                    disabled={busy}
                    required
                    aria-label={`Label name for ${label.id}`}
                  />
                </div>
                <p className="mb-2 text-xs text-muted">
                  Key{' '}
                  <code className="rounded bg-sidebar/5 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    {label.id}
                  </code>
                  <button
                    type="button"
                    className="link-sidebar ml-2"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt(
                        'Stable id (letters, numbers, - _)',
                        label.id,
                      );
                      if (next != null) onRenameLabelId(label.id, next);
                    }}
                  >
                    Change
                  </button>
                </p>
                <Button
                  type="button"
                  variant="dangerQuiet"
                  disabled={busy || labels.length <= 1}
                  onClick={() => onRemoveLabel(label.id)}
                  className="mb-1.5 min-h-9 px-3 text-xs"
                >
                  Remove
                </Button>
                </AdminInset>
              </li>
            ))}
          </ul>
        </PanelBlock>
        {showJsonImport ? (
          <PanelBlock>
            <div>
              <span className={FORM_LABEL_CLASS}>Paste bot group JSON</span>
              <p className="mt-0.5 text-xs text-muted">
                Accepts an array,{' '}
                <code className="font-mono text-[11px]">{'{ "labels": [...], "groups": [...] }'}</code>
                , or one group object. Labels are picker rows; each group has a{' '}
                <code className="font-mono text-[11px]">labelId</code> and optional{' '}
                <code className="font-mono text-[11px]">description</code>. Merge updates matching
                ids and appends new ones; Replace swaps the whole list. Save afterward to persist.
              </p>
            </div>
            <TextAreaField
              value={importJsonText}
              onChange={(e) => onImportJsonText(e.target.value)}
              rows={12}
              className={`font-mono text-xs leading-relaxed ${
                importPreview && !importPreview.ok && importJsonText.trim()
                  ? 'border-danger/40 focus:border-danger/50 focus:ring-danger/15'
                  : ''
              }`}
              placeholder={`{\n  "labels": [{ "id": "groups", "name": "Groups" }],\n  "groups": [{\n    "id": "tight-table",\n    "name": "Tight Table",\n    "labelId": "groups",\n    "description": "Nits and ABC regs",\n    "isDefault": false,\n    "defaultPersonality": null,\n    "names": ["StoneWall", "FoldBot"],\n    "namePersonalities": { "StoneWall": "nit", "FoldBot": "nit" }\n  }]\n}`}
              aria-label="Bot groups JSON"
              aria-invalid={Boolean(importPreview && !importPreview.ok && importJsonText.trim())}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[10rem] max-w-xs flex-1">
                <SelectField
                  label="Import mode"
                  value={importMode}
                  onChange={(e) => onImportMode(e.target.value as BotGroupsImportMode)}
                  disabled={busy}
                >
                  <option value="merge">Merge (add / update by id)</option>
                  <option value="replace">Replace all groups</option>
                </SelectField>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !importJsonText.trim() || importPreview?.ok !== true}
                onClick={onImportJson}
                className="min-h-9 px-4 text-xs"
              >
                Import into editor
              </Button>
            </div>
            {importPreview?.ok === true ? (
              <p className="text-xs text-muted">
                Ready: {importPreview.groups.length} group
                {importPreview.groups.length === 1 ? '' : 's'} (
                {importPreview.groups.map((g) => g.name || g.id).join(', ')})
              </p>
            ) : null}
            {importPreview && !importPreview.ok && importJsonText.trim() ? (
              <ul
                className="space-y-1 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
                role="alert"
              >
                {importPreview.errors.slice(0, 12).map((err) => (
                  <li key={err}>{err}</li>
                ))}
                {importPreview.errors.length > 12 ? (
                  <li>+{importPreview.errors.length - 12} more</li>
                ) : null}
              </ul>
            ) : null}
          </PanelBlock>
        ) : null}

        <SplitPane
          sidebarLabel="Bot groups"
          sidebar={botGroups.map((g) => {
            const draft = groupBulkText(g, botNameDrafts);
            const parsed = parseBulkBotRoster(draft);
            const nameCount = parsed.ok ? parsed.names.length : g.names.length;
            const rowName = labels.find((l) => l.id === g.labelId)?.name ?? g.labelId;
            return (
              <SplitItem
                key={g.id}
                selected={group?.id === g.id}
                title={g.name || 'Untitled'}
                meta={`${rowName} · ${nameCount} name${nameCount === 1 ? '' : 's'}`}
                badge={g.isDefault ? 'Default' : undefined}
                onSelect={() => onSelectGroup(g.id)}
              />
            );
          })}
        >
          {group ? (
            <BotGroupEditor
              group={group}
              labels={labels}
              botNameDrafts={botNameDrafts}
              botNameInput={botNameInput}
              showBulkEdit={showBulkEdit}
              busy={busy}
              canRemove={botGroups.length > 1}
              onRenameId={onRenameId}
              onUpdateGroup={onUpdateGroup}
              onDefaultPersonality={onDefaultPersonality}
              onNamePersonality={onNamePersonality}
              onNameInput={onNameInput}
              onAddName={onAddName}
              onRemoveName={onRemoveName}
              onDraft={onDraft}
              onToggleBulk={onToggleBulk}
              onRemoveGroup={onRemoveGroup}
            />
          ) : (
            <EmptyPane>Add a bot group to get started.</EmptyPane>
          )}
        </SplitPane>

        <SaveBar hint="Host create, table +Bot, and offline solo all apply these names and styles.">
          <Button
            type="submit"
            disabled={
              busy ||
              botGroups.some((g) => !parseBulkBotRoster(groupBulkText(g, botNameDrafts)).ok)
            }
            className={ADMIN_SAVE_BTN}
          >
            {busyKey === 'bots' ? 'Saving…' : 'Save bot groups'}
          </Button>
        </SaveBar>
      </form>
    </Section>
  );
}

function BotGroupEditor({
  group,
  labels,
  botNameDrafts,
  botNameInput,
  showBulkEdit,
  busy,
  canRemove,
  onRenameId,
  onUpdateGroup,
  onDefaultPersonality,
  onNamePersonality,
  onNameInput,
  onAddName,
  onRemoveName,
  onDraft,
  onToggleBulk,
  onRemoveGroup,
}: {
  group: BotGroup;
  labels: BotGroupLabels;
  botNameDrafts: Record<string, string>;
  botNameInput: string;
  showBulkEdit: boolean;
  busy: boolean;
  canRemove: boolean;
  onRenameId: (fromId: string, rawNext: string) => void;
  onUpdateGroup: (id: string, patch: Partial<BotGroup>) => void;
  onDefaultPersonality: (id: string, value: string) => void;
  onNamePersonality: (groupId: string, name: string, value: string) => void;
  onNameInput: (value: string) => void;
  onAddName: (id: string, raw: string) => void;
  onRemoveName: (id: string, name: string) => void;
  onDraft: (id: string, text: string) => void;
  onToggleBulk: (group: BotGroup) => void;
  onRemoveGroup: (id: string) => void;
}) {
  const draft = groupBulkText(group, botNameDrafts);
  const parsed = parseBulkBotRoster(draft);
  const bulkErrors = showBulkEdit && !parsed.ok ? parsed.errors : [];
  const names = parsed.ok ? parsed.names : group.names;
  const displayPersonalities = parsed.ok ? parsed.namePersonalities : group.namePersonalities;
  const labelValue = labels.some((l) => l.id === group.labelId)
    ? group.labelId
    : labels[0]?.id ?? group.labelId;

  return (
    <div className="space-y-5">
      <DetailHeader
        title={
          <div className="max-w-md">
            <TextField
              label="Group name"
              value={group.name}
              onChange={(e) => onUpdateGroup(group.id, { name: e.target.value })}
              maxLength={48}
              required
              placeholder="e.g. Classic, Friends, Villains"
            />
          </div>
        }
        meta={
          <p className="mt-2 text-xs text-muted">
            Key{' '}
            <code className="rounded bg-sidebar/5 px-1.5 py-0.5 font-mono text-[11px] text-primary">
              {group.id}
            </code>
            <button
              type="button"
              className="link-sidebar ml-2"
              onClick={() => {
                const next = window.prompt('Stable id (letters, numbers, - _)', group.id);
                if (next != null) onRenameId(group.id, next);
              }}
            >
              Change
            </button>
          </p>
        }
        actions={
          <>
            {group.isDefault ? (
              <span className="inline-flex min-h-9 items-center rounded-full border border-sidebar/20 bg-sidebar/8 px-3 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-sidebar">
                Default pack
              </span>
            ) : (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onUpdateGroup(group.id, { isDefault: true })}
                className="min-h-9 px-3 text-xs"
              >
                Make default
              </Button>
            )}
            <Button
              variant="dangerQuiet"
              disabled={busy || !canRemove}
              onClick={() => {
                if (!canRemove) return;
                onRemoveGroup(group.id);
              }}
              className="min-h-9 px-3 text-xs"
            >
              Remove
            </Button>
          </>
        }
      />

      <TextField
        label="Description"
        value={group.description ?? ''}
        onChange={(e) => onUpdateGroup(group.id, { description: e.target.value })}
        maxLength={120}
        disabled={busy}
        placeholder="Short blurb shown under this pack in the picker"
        help="Shown to hosts and offline players when this pack is selected."
      />

      <TextField
        label="Offline win Whuffies"
        type="number"
        min={0}
        max={100_000}
        value={String(group.winWhuffies ?? 0)}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          onUpdateGroup(group.id, {
            winWhuffies: Number.isFinite(n)
              ? Math.max(0, Math.min(100_000, n))
              : 0,
          });
        }}
        disabled={busy}
        help="Whuffies credited when a signed-in player wins the offline session (all bots busted). 0 = off."
      />

      <div className="grid max-w-md gap-4 sm:grid-cols-2">
        <SelectField
          label="Label"
          value={labelValue}
          onChange={(e) => onUpdateGroup(group.id, { labelId: e.target.value })}
          disabled={busy || labels.length === 0}
          help="Which picker row this pack appears on."
        >
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Default style"
          value={group.defaultPersonality ?? ''}
          onChange={(e) => onDefaultPersonality(group.id, e.target.value)}
          disabled={busy}
          help="Used when a name has no style override. Auto keeps classic name map."
        >
          <option value="">Auto (by name / hash)</option>
          {BOT_PERSONALITY_IDS.map((id) => (
            <option key={id} value={id}>
              {PERSONALITY_LABELS[id]}
            </option>
          ))}
        </SelectField>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className={FORM_LABEL_CLASS}>Display names & styles</span>
            <p className="mt-0.5 text-xs text-muted">
              {names.length}/40 · shown at the table when bots sit
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleBulk(group)}
            className="link-sidebar text-xs"
          >
            {showBulkEdit ? 'Chip editor' : 'Bulk edit'}
          </button>
        </div>

        {showBulkEdit ? (
          <div className="space-y-2">
            <TextAreaField
              value={draft}
              onChange={(e) => onDraft(group.id, e.target.value)}
              rows={10}
              className={`font-mono text-xs leading-relaxed ${
                bulkErrors.length > 0
                  ? 'border-danger/40 focus:border-danger/50 focus:ring-danger/15'
                  : ''
              }`}
              placeholder={DEFAULT_BOT_NAMES}
              aria-invalid={bulkErrors.length > 0}
              aria-label="Bot names and styles, one per line"
            />
            <p className="text-xs text-muted">
              One bot per line: <code className="font-mono text-[11px]">Name</code> or{' '}
              <code className="font-mono text-[11px]">Name, style</code>. Styles:{' '}
              {BOT_PERSONALITY_IDS.join(', ')}.
            </p>
            {bulkErrors.length > 0 ? (
              <ul
                className="space-y-1 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
                role="alert"
              >
                {bulkErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <AdminTableShell>
            <AdminList className="rounded-none border-0">
              {names.map((n) => (
                <AdminListRow key={n}>
                  <span className="font-row-label min-w-0 flex-1">
                    {n}
                  </span>
                  <select
                    value={displayPersonalities[n] ?? ''}
                    onChange={(e) => onNamePersonality(group.id, n, e.target.value)}
                    className="min-h-8 max-w-[11rem] rounded-md border border-sidebar/20 bg-white/90 px-2 text-xs text-primary"
                    aria-label={`Style for ${n}`}
                    disabled={busy}
                  >
                    <option value="">
                      {group.defaultPersonality
                        ? `Default (${PERSONALITY_LABELS[group.defaultPersonality]})`
                        : 'Default (auto)'}
                    </option>
                    {BOT_PERSONALITY_IDS.map((id) => (
                      <option key={id} value={id}>
                        {PERSONALITY_LABELS[id]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemoveName(group.id, n)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${n}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </AdminListRow>
              ))}
              {names.length === 0 ? (
                <li className="admin-empty">No names yet.</li>
              ) : null}
            </AdminList>
            <div className="flex flex-col gap-2 border-t border-sidebar/8 bg-page/[0.55] px-3 py-2.5 sm:flex-row sm:items-center">
              <TextField
                value={botNameInput}
                onChange={(e) => onNameInput(e.target.value.slice(0, 24))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddName(group.id, botNameInput);
                  }
                }}
                className="sm:max-w-xs"
                placeholder="Add a name…"
                maxLength={24}
                disabled={names.length >= 40}
                aria-label="New bot name"
              />
              <Button
                variant="ghost"
                disabled={busy || names.length >= 40 || !botNameInput.trim()}
                onClick={() => onAddName(group.id, botNameInput)}
                className="min-h-9 px-4 text-xs"
              >
                Add name
              </Button>
            </div>
          </AdminTableShell>
        )}
      </div>
    </div>
  );
}
