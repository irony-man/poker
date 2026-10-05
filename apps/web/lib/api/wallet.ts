import type { WalletCurrency, WalletTrailPage } from '@poker/protocol';
import { authedFetch } from './client';

export type WalletTrailQuery = {
  currency: WalletCurrency;
  before?: string | null;
  limit?: number;
};

export function walletTrailQueryString(q: WalletTrailQuery): string {
  const params = new URLSearchParams({ currency: q.currency });
  if (q.before) params.set('before', q.before);
  if (q.limit) params.set('limit', String(q.limit));
  return params.toString();
}

export async function fetchWalletTrail(
  sessionToken: string,
  q: WalletTrailQuery,
): Promise<WalletTrailPage> {
  return authedFetch(`/api/me/wallet/trail?${walletTrailQueryString(q)}`, {
    sessionToken,
  }) as Promise<WalletTrailPage>;
}
