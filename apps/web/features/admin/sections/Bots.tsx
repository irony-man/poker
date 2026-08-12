import { BOT_PERSONALITY_IDS } from '@poker/engine';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField';
import type { BotGroup } from '@/lib/api';
import {
  DEFAULT_BOT_NAMES,
  MAX_BOT_GROUPS,
  PERSONALITY_LABELS,
  groupBulkText,
  parseBulkBotRoster,
} from '../botRoster';
import { FORM_LABEL_CLASS } from '@/components/ui/TextField';
import { Section } from '../ui';

export function BotsSection({
  botGroups,
  botNameDrafts,
  openBotGroup,
  botNameInput,
  showBulkEdit,
  busy,
  busyKey,
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
  onSave,
}: {
  botGroups: BotGroup[];
  botNameDrafts: Record<string, string>;
  openBotGroup: string | null;
  botNameInput: string;
  showBulkEdit: boolean;
  busy: boolean;
  busyKey: string | null;
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
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Bot groups"
      description="Name packs and playing styles hosts use when seating bots. Pick a group default style and optional per-name overrides."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tabular-nums text-ink-strong-muted">
            {botGroups.length}/{MAX_BOT_GROUPS}
          </span>
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
        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
          <div
            className="flex flex-col gap-1.5 rounded-xl border border-sidebar/10 bg-mushroom/[0.04] p-2"
            role="listbox"
            aria-label="Bot groups"
          >
            {botGroups.map((group) => {
              const selected = openBotGroup === group.id;
              const draft = groupBulkText(group, botNameDrafts);
              const parsed = parseBulkBotRoster(draft);
              const nameCount = parsed.ok ? parsed.names.length : group.names.length;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelectGroup(group.id)}
                  className={`rounded-lg px-3 py-2.5 text-left transition ${
                    selected
                      ? 'bg-sidebar text-mushroom shadow-[0_4px_12px_rgb(29_4_50/0.16)]'
                      : 'text-ink-strong hover:bg-sidebar/8'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate font-display text-sm font-semibold uppercase tracking-wider ${
                        selected ? 'text-mushroom' : 'text-ink-strong'
                      }`}
                    >
                      {group.name || 'Untitled'}
                    </span>
                    {group.isDefault ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                          selected ? 'bg-mushroom/20 text-mushroom' : 'bg-sidebar/10 text-sidebar'
                        }`}
                      >
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs tabular-nums ${
                      selected ? 'text-mushroom/75' : 'text-ink-strong-muted'
                    }`}
                  >
                    {nameCount} name{nameCount === 1 ? '' : 's'}
                  </span>
                </button>
              );
            })}
          </div>

          {(() => {
            const group = botGroups.find((g) => g.id === openBotGroup) ?? botGroups[0];
            if (!group) {
              return (
                <p className="rounded-xl border border-dashed border-sidebar/15 px-4 py-10 text-center text-sm text-ink-strong-muted">
                  Add a bot group to get started.
                </p>
              );
            }
            const draft = groupBulkText(group, botNameDrafts);
            const parsed = parseBulkBotRoster(draft);
            const bulkErrors = showBulkEdit && !parsed.ok ? parsed.errors : [];
            const names = parsed.ok ? parsed.names : group.names;
            const displayPersonalities = parsed.ok
              ? parsed.namePersonalities
              : group.namePersonalities;
            return (
              <div className="min-w-0 space-y-4 rounded-xl border border-sidebar/12 bg-cream p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
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
                    <p className="text-xs text-ink-strong-muted">
                      Key{' '}
                      <code className="rounded bg-sidebar/5 px-1.5 py-0.5 font-mono text-[11px] text-ink-strong">
                        {group.id}
                      </code>
                      <button
                        type="button"
                        className="ml-2 font-medium text-sidebar underline-offset-2 hover:underline"
                        onClick={() => {
                          const next = window.prompt(
                            'Stable id (letters, numbers, - _)',
                            group.id,
                          );
                          if (next != null) onRenameId(group.id, next);
                        }}
                      >
                        Change
                      </button>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
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
                      disabled={busy || botGroups.length <= 1}
                      onClick={() => {
                        if (botGroups.length <= 1) return;
                        onRemoveGroup(group.id);
                      }}
                      className="min-h-9 px-3 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="max-w-md">
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
                      <p className="mt-0.5 text-xs text-ink-strong-muted">
                        {names.length}/40 · shown at the table when bots sit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleBulk(group)}
                      className="text-xs font-medium text-sidebar underline-offset-2 hover:underline"
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
                      <p className="text-xs text-ink-strong-muted">
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
                    <div className="rounded-xl border border-sidebar/12 bg-mushroom/[0.04] p-3">
                      <ul className="space-y-2">
                        {names.map((n) => (
                          <li
                            key={n}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-sidebar/10 bg-cream px-2.5 py-1.5 shadow-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                              {n}
                            </span>
                            <select
                              value={displayPersonalities[n] ?? ''}
                              onChange={(e) => onNamePersonality(group.id, n, e.target.value)}
                              className="min-h-8 max-w-[10rem] rounded-md border border-sidebar/15 bg-white px-2 text-xs text-ink-strong"
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
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-strong-muted transition hover:bg-danger/10 hover:text-danger"
                              aria-label={`Remove ${n}`}
                              title="Remove"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                        {names.length === 0 ? (
                          <li className="text-sm text-ink-strong-muted">No names yet.</li>
                        ) : null}
                      </ul>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                          className="min-h-11 px-4"
                        >
                          Add name
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar/8 pt-4">
          <p className="text-xs text-ink-strong-muted">
            Host create, table +Bot, and offline solo all apply these names and styles.
          </p>
          <Button
            type="submit"
            disabled={
              busy ||
              botGroups.some((g) => !parseBulkBotRoster(groupBulkText(g, botNameDrafts)).ok)
            }
            className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
          >
            {busyKey === 'bots' ? 'Saving…' : 'Save bot groups'}
          </Button>
        </div>
      </form>
    </Section>
  );
}
