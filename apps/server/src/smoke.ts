/**
 * Lightweight smoke harness for local QA (anonymous register path).
 * Usage (server must be running without CLERK_SECRET_KEY): npx tsx src/smoke.ts
 */
const API = process.env.API_URL ?? 'http://localhost:4000';

async function main() {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('health failed');

  const aRes = await fetch(`${API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `SmokeA${Date.now()}` }),
  });
  if (aRes.status === 401) {
    console.log('smoke skipped: server requires Clerk JWT (unset CLERK_SECRET_KEY for anonymous smoke)');
    return;
  }
  const a = (await aRes.json()) as { userId: string; name: string };
  if (!a.userId) throw new Error(`register A failed: ${JSON.stringify(a)}`);

  const bRes = await fetch(`${API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `SmokeB${Date.now()}` }),
  });
  const b = (await bRes.json()) as { userId: string; name: string };
  if (!bRes.ok || !b.userId) throw new Error(`register B failed: ${JSON.stringify(b)}`);

  const tableRes = await fetch(`${API}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: a.userId,
      name: 'Smoke Table',
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 200,
      maxBuyIn: 1000,
      turnTimeMs: 20000,
      maxSeats: 6,
      isPrivate: true,
    }),
  });
  const table = (await tableRes.json()) as { tableId?: string; inviteCode?: string };
  if (!table.tableId || !table.inviteCode) throw new Error(`create table failed: ${JSON.stringify(table)}`);

  const invite = await fetch(`${API}/api/tables/invite/${table.inviteCode}`).then((r) => r.json());
  if (invite.tableId !== table.tableId) throw new Error('invite mismatch');

  console.log('smoke ok', {
    tableId: table.tableId,
    invite: table.inviteCode,
    users: [a.name, b.name],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
