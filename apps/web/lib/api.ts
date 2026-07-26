export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws';

export async function register(name: string) {
  const res = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ userId: string; name: string; ticket: string }>;
}

export async function createTable(input: {
  userId: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimeMs: number;
  maxSeats: number;
  isPrivate: boolean;
}) {
  const res = await fetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      turnTimeMs: number;
    };
  }>;
}

export async function resolveInvite(code: string) {
  const res = await fetch(`${API_URL}/api/tables/invite/${code}`);
  if (!res.ok) throw new Error('Invite not found');
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      turnTimeMs: number;
    };
  }>;
}
