import { BadRequestException } from '@nestjs/common';
import { WALLET_CURRENCIES, WALLET_TRAIL_MAX_LIMIT, type WalletCurrency } from '@poker/protocol';
import { z } from 'zod';
import { WalletError } from './wallet.constants.js';
import type { WalletService } from './wallet.service.js';

const TrailQuerySchema = z.object({
  currency: z.enum(WALLET_CURRENCIES as [WalletCurrency, ...WalletCurrency[]]).default('chips'),
  before: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(WALLET_TRAIL_MAX_LIMIT).optional(),
});

/** Shared by the self-service and admin trail routes. */
export async function listTrailFromQuery(
  wallet: WalletService,
  userId: string,
  query: unknown,
) {
  const parsed = TrailQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw new BadRequestException({ error: parsed.error.message });
  }
  try {
    return await wallet.listTrail(userId, parsed.data.currency, {
      before: parsed.data.before ?? null,
      limit: parsed.data.limit,
    });
  } catch (err) {
    if (err instanceof WalletError) {
      throw new BadRequestException({ error: err.message, code: err.code });
    }
    throw err;
  }
}
