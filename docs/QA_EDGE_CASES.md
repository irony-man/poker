# Disconnect mid-hand
- Client closes WS during their turn → seat remains; turn timer still fires auto check/fold
- Client reconnects with same ticket + join_table → receives state_sync with private hole cards

# Pots
- 3+ all-in players with stacks 50/100/300 → side pots + chip conservation
- Exact tie at showdown → split pot; odd chip to earliest seat left of dealer
- Short all-in facing raise → side pot among remaining players only

# Rules
- Heads-up blinds: button is SB and acts first preflop; BB acts first postflop
- Everyone folds to one player → pot awarded; hole cards stay private (not revealed)
- Action when not toAct / wrong handId / stale seq → rejected, version unchanged
- Spectator (joined, not seated) never receives hole cards in private view

# Economy
- Re-buy / top-up only in waiting/payout
- Buy-in outside min/max rejected
- One seat per userId per table

# Abuse
- Chat/action rate limits return errors / drop messages
- Invalid Zod payloads rejected with bad_schema
