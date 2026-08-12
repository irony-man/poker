import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { AdminRoomSettings, SiteEconomy } from '@/lib/api';
import { Section } from '../ui';

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
  onRoomSettings: (patch: AdminRoomSettings) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Section
      title="Economy & rooms"
      description="New-player chip grants, free chip refills, starting Whuffies rating, and how long empty tables stay open."
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
          help="Rating granted on signup. Contest placements add more Whuffies (not spendable chips)."
        />
        <div className="sm:col-span-2">
          <TextField
            label="Room inactivity (minutes)"
            type="number"
            min={1}
            max={1440}
            step={1}
            value={roomSettings.inactivityMinutes}
            onChange={(e) => onRoomSettings({ inactivityMinutes: Number(e.target.value) })}
            className="tabular-nums"
            help="Close private/public cash tables after this many minutes with no humans present (default 15). Contests are never auto-closed. Allowed range: 1–1440 minutes."
          />
        </div>
        <div className="sm:col-span-3">
          <Button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
          >
            {busyKey === 'economy' ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </Section>
  );
}
