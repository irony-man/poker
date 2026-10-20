import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { AdminPublicTableTimings, AdminRoomSettings, SiteEconomy } from '@/lib/api';
import { ADMIN_SAVE_BTN, SaveBar, Section } from '../ui';

export type RoomSettingsPatch = Partial<Omit<AdminRoomSettings, 'publicTable'>> & {
  publicTable?: Partial<AdminPublicTableTimings>;
};

const PUBLIC_TABLE_FIELDS: {
  key: keyof AdminPublicTableTimings;
  label: string;
  min: number;
  max: number;
  help: string;
}[] = [
  {
    key: 'botFillSeconds',
    label: 'Bot fill wait (seconds)',
    min: 3,
    max: 120,
    help: 'How long a player waits in the Play now queue before bots fill the table (default 15, 3–120).',
  },
  {
    key: 'nextHandSeconds',
    label: 'Next hand delay (seconds)',
    min: 2,
    max: 60,
    help: 'Public tables deal automatically this long after each hand (default 10, 2–60).',
  },
  {
    key: 'turnSeconds',
    label: 'Turn timer (seconds)',
    min: 5,
    max: 120,
    help: 'Time each player has to act on public tables (default 20, 5–120).',
  },
  {
    key: 'idleCloseSeconds',
    label: 'Empty table close (seconds)',
    min: 10,
    max: 3600,
    help: 'Close a public table after this long with no humans (default 60, 10–3600).',
  },
];

export function EconomySection({
  economy,
  roomSettings,
  busy,
  busyKey,
  onEconomy,
  onRoomSettings,
  onSave,
}: {
  economy: SiteEconomy;
  roomSettings: AdminRoomSettings;
  busy: boolean;
  busyKey: string | null;
  onEconomy: (patch: Partial<SiteEconomy>) => void;
  onRoomSettings: (patch: RoomSettingsPatch) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Economy & rooms"
      description="New-player chip grants, free chip refills, Whuffies rating grants, how long empty tables stay open, and public table timings."
    >
      <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Starting chips"
          type="number"
          min={1}
          step={1}
          value={economy.startingChipGrant}
          onChange={(e) => onEconomy({ startingChipGrant: Number(e.target.value) })}
          className="tabular-nums"
        />
        <TextField
          label="Refill threshold"
          type="number"
          min={1}
          step={1}
          value={economy.refillThreshold}
          onChange={(e) => onEconomy({ refillThreshold: Number(e.target.value) })}
          className="tabular-nums"
        />
        <TextField
          label="Refill grant"
          type="number"
          min={1}
          step={1}
          value={economy.refillGrant}
          onChange={(e) => onEconomy({ refillGrant: Number(e.target.value) })}
          className="tabular-nums"
        />
        <TextField
          label="Starting Whuffies"
          type="number"
          min={0}
          step={1}
          value={economy.startingWhuffieGrant}
          onChange={(e) => onEconomy({ startingWhuffieGrant: Number(e.target.value) })}
          className="tabular-nums"
          help="Rating granted on signup. Contests and completed table games add more Whuffies (not spendable chips)."
        />
        <TextField
          label="Whuffies per completed game"
          type="number"
          min={0}
          step={1}
          value={economy.tableGameWhuffies}
          onChange={(e) => onEconomy({ tableGameWhuffies: Number(e.target.value) })}
          className="tabular-nums"
          help="Awarded when a player busts or is the last with chips on a hosted or public table. 0 disables."
        />
        <TextField
          label="Minimum hands per game"
          type="number"
          min={0}
          max={1000}
          step={1}
          value={economy.tableGameMinHands}
          onChange={(e) => onEconomy({ tableGameMinHands: Number(e.target.value) })}
          className="tabular-nums"
          help="A game only earns Whuffies after the player was dealt this many hands since sitting down, topping up, or their last finished game. Stops bust-and-rebuy farming (default 10, 0 = no minimum)."
        />
        <TextField
          label="Tables analysed per day"
          type="number"
          min={0}
          max={200}
          step={1}
          value={roomSettings.analysisDailyLimit}
          onChange={(e) => onRoomSettings({ analysisDailyLimit: Number(e.target.value) })}
          className="tabular-nums"
          help="How many tables each player can analyse per UTC day. The server enforces this; a client cannot raise it. Opening a table already analysed that day does not use another slot. 0 turns new analyses off."
        />
        <div className="sm:col-span-3">
          <TextField
            label="Room inactivity (minutes)"
            type="number"
            min={1}
            max={1440}
            step={1}
            value={roomSettings.inactivityMinutes}
            onChange={(e) => onRoomSettings({ inactivityMinutes: Number(e.target.value) })}
            className="tabular-nums"
            help="Close private cash tables after this many minutes with no humans present (default 15). Contests are never auto-closed. Allowed range: 1–1440 minutes."
          />
        </div>
        <div className="sm:col-span-3">
          <p className="text-sm font-semibold text-primary">Public table</p>
          <p className="text-xs text-muted">
            Changes apply to newly matched tables; tables already running keep their timings until
            they close.
          </p>
        </div>
        {PUBLIC_TABLE_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            type="number"
            min={f.min}
            max={f.max}
            step={1}
            value={roomSettings.publicTable[f.key]}
            onChange={(e) =>
              onRoomSettings({ publicTable: { [f.key]: Number(e.target.value) } })
            }
            className="tabular-nums"
            help={f.help}
          />
        ))}
        <div className="sm:col-span-3">
          <SaveBar>
            <Button type="submit" disabled={busy} className={ADMIN_SAVE_BTN}>
              {busyKey === 'economy' ? 'Saving…' : 'Save settings'}
            </Button>
          </SaveBar>
        </div>
      </form>
    </Section>
  );
}
