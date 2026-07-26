/**
 * Lightweight smoke harness for local QA.
 * Usage (server must be running): npx tsx src/smoke.ts
 */
const API = process.env.API_URL ?? 'http://localhost:4000';

async function main() {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('health failed');

  const a = await fetch(`${API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `SmokeA${Date.now()}` }),
  }).then((r) => r.json());

  const b = await fetch(`${API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `SmokeB${Date.now()}` }),
  }).then((r) => r.json());

  const table = await fetch(`${API}/api/tables`, {
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
  }).then((r) => r.json());

  if (!table.tableId || !table.inviteCode) throw new Error('create table failed');

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
