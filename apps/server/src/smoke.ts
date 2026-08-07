/**
 * Lightweight smoke harness for local QA (username/password auth).
 * Usage: npx tsx src/smoke.ts  (server must be running)
 */
const API = process.env.API_URL ?? 'http://localhost:4000';

async function main() {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('health failed');

  const suffix = Date.now().toString(36);
  const aUser = `smoke_a_${suffix}`;
  const bUser = `smoke_b_${suffix}`;
  const password = 'smoke-pass-1';

  const aRes = await fetch(`${API}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: aUser, password }),
  });
  const a = (await aRes.json()) as {
    userId?: string;
    name?: string;
    sessionToken?: string;
    ticket?: string;
  };
  if (!aRes.ok || !a.userId || !a.sessionToken || !a.ticket) {
    throw new Error(`signup A failed: ${JSON.stringify(a)}`);
  }

  const bRes = await fetch(`${API}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: bUser, password }),
  });
  const b = (await bRes.json()) as { userId?: string; name?: string };
  if (!bRes.ok || !b.userId) throw new Error(`signup B failed: ${JSON.stringify(b)}`);

  const tableRes = await fetch(`${API}/api/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${a.sessionToken}`,
    },
    body: JSON.stringify({
      name: 'Smoke Table',
      smallBlind: 5,
      bigBlind: 10,
      buyIn: 1000,
      turnTimeMs: 20000,
      maxSeats: 6,
      isPrivate: true,
    }),
  });
  const table = (await tableRes.json()) as { tableId?: string; inviteCode?: string };
  if (!table.tableId || !table.inviteCode) {
    throw new Error(`create table failed: ${JSON.stringify(table)}`);
  }

  const invite = await fetch(`${API}/api/tables/invite/${table.inviteCode}`).then((r) => r.json());
  if (invite.tableId !== table.tableId) throw new Error('invite mismatch');

  const ticketRes = await fetch(`${API}/api/ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${a.sessionToken}`,
    },
    body: '{}',
  });
  const ticketBody = (await ticketRes.json()) as { ticket?: string };
  if (!ticketRes.ok || !ticketBody.ticket) throw new Error(`ticket failed: ${JSON.stringify(ticketBody)}`);

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
