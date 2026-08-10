import {
  defaultEconomy,
  type EconomySnapshot,
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
} from '../wallet/wallet.constants.js';

export interface SiteAnnouncement {
  enabled: boolean;
  text: string;
}

export interface SiteConfigPayload {
  announcement: SiteAnnouncement;
  economy: EconomySnapshot;
}

export function defaultSiteConfig(): SiteConfigPayload {
  return {
    announcement: { enabled: false, text: '' },
    economy: defaultEconomy(),
  };
}

function clampPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

export function normalizeSiteConfig(raw: unknown): SiteConfigPayload {
  const defaults = defaultSiteConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as Record<string, unknown>;

  let announcement = defaults.announcement;
  if (o.announcement && typeof o.announcement === 'object') {
    const a = o.announcement as Record<string, unknown>;
    announcement = {
      enabled: Boolean(a.enabled),
      text: typeof a.text === 'string' ? a.text.slice(0, 2000) : '',
    };
  }

  let economy = defaults.economy;
  if (o.economy && typeof o.economy === 'object') {
    const e = o.economy as Record<string, unknown>;
    economy = {
      startingChipGrant: clampPositiveInt(e.startingChipGrant, STARTING_CHIP_GRANT),
      refillThreshold: clampPositiveInt(e.refillThreshold, REFILL_THRESHOLD),
      refillGrant: clampPositiveInt(e.refillGrant, REFILL_GRANT),
    };
  }

  return { announcement, economy };
}
