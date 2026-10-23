# Literal colour audit

Counts after the palette v2 pass, from:

```
rg -c '#[0-9a-fA-F]{3,8}\b' apps/web/{app,components,features,lib} -g '!*.test.*'
rg -c 'rgba?\([0-9]' apps/web/{app,components,features,lib}
rg -o '(bg|text|border|from|to|via|fill|stroke|ring|shadow)-\[#' apps/web/{app,components,features}
```

| Kind | Count |
| --- | --- |
| hex, rg -c lines summed | 161 |
| rgb()/rgba(), rg -c lines summed | 76 |
| Tailwind arbitrary, rg -o matches | 23 |

Bucket (a) theme colours that duplicated a token were replaced with `rgb(var(--…))` keeping the alpha. Flag off, those vars hold the previous triplet, so the paint matches today. Flag on, they follow the designer palette.

Replaced families:

- `29 4 50` / `29_4_50` → `--ds-brand-ink` (baseline `29 4 50`, palette `30 5 54`)
- `14 6 24` ink shadow → `--ds-literal-ink`
- placeholder `68 48 74` → `--ds-text-placeholder`
- frost ink `22 12 40` → `--ds-frost-ink`; white-field ink → `--ds-field-ink`
- frost muted `58 40 82` → `--ds-frost-muted`; white-field muted → `--ds-field-muted`
- paper `255 252 250` backgrounds → `--ds-paper`
- Arcade `253 233 61` → `--bg-page`; `#1a1028` → `--text-primary`; card `#fff` → `--ds-card`; `color: #fff` on Arcade/Glass chrome → `--on-chrome`
- Profile look swatches → `--ds-swatch-v*`
- `app/layout.tsx` themeColor light `#e8dad8`, dark `#1e0536`
- `lib/ogImage.tsx` keeps the 145° three-stop linear gradient and swaps stops to Classic g_hero `#3d1766`, `#1e0536`, `#13021f`. Text `#e8dad8`.

Not replaced on purpose:

- NEW badge uses `bg-danger` / `bg-brass`, not a literal, so `--ds-new-badge` is emitted and unwired.
- Money still uses `brass` (G4). `--ds-gold` / `--ds-gold-light` / `--ds-gold-dim` stay on the gold primitives for a follow-up.
- `apps/server/src/mail/mail.service.ts` (8 hex) was not changed. Needs approval before a Classic brand/page swap.
- `app/icon.png` and `app/apple-icon.png` are rasters. Not touched.
- Felt presets in `lib/tableColors.ts` and `.table-theme` stay. The server copy (`apps/server/src/table-colors.ts`) only clamps the id; it does not duplicate the hex values.

### Bucket (b) — game and asset colours, unchanged (136)

- app/globals.css — Table felt preset (G7, left unchanged): 14 (`#0a0414` L1119, `#0a1028` L1141, `#061428` L1163, `#140818` L1185, `#0a0a0c` L1207, `#04140c` L1229, …)
- components/CardFaceView.tsx — Game or asset colour (board, dice, card face, chip, felt preset): 6 (`#ffffff` L121, `#ffffff` L121, `#f2f2f2` L121, `rgba(255,255,255,0.95)` L128, `rgba(255,255,255,0.55)` L128, `rgba(0,0,0,0.08)` L134)
- components/ChipStack.tsx — Game or asset colour (board, dice, card face, chip, felt preset): 22 (`#1e293b` L26, `#94a3b8` L26, `#f1f5f9` L26, `#0c1a33` L27, `#d4dce8` L27, `#ffffff` L27, …)
- components/PlayingCard.tsx — Game or asset colour (board, dice, card face, chip, felt preset): 11 (`#f0e6e4` L144, `#e6d9d7` L144, `#d9cac7` L144, `rgba(29,4,50,0.08)` L152, `rgba(29,4,50,0.1)` L153, `rgba(29,4,50,0.07)` L154, …)
- components/ludo/LudoBoard.tsx — Game or asset colour (board, dice, card face, chip, felt preset): 26 (`#0a1630` L231, `rgb(26 80 180 / 0.18)` L232, `rgb(20 50 120 / 0.16)` L233, `rgb(0_0_0_/_0.28)` L237, `#111` L263, `#111` L264, …)
- components/ludo/LudoDice3D.tsx — Game or asset colour (board, dice, card face, chip, felt preset): 25 (`#ffffff` L69, `#f4efec` L70, `#e4d8d4` L71, `rgba(29, 4, 50, 0.12)` L75, `#1d0432` L79, `#1d0432` L220, …)
- lib/cardFaceTheme.ts — Game or asset colour (board, dice, card face, chip, felt preset): 4 (`#C8102E` L96, `#C8102E` L97, `#1A1A1A` L98, `#1A1A1A` L99)
- lib/ludoBoard.ts — Game or asset colour (board, dice, card face, chip, felt preset): 4 (`#E31C23` L13, `#2E9B3E` L14, `#F5C518` L15, `#1A6FDB` L16)
- lib/tableColors.ts — Game or asset colour (board, dice, card face, chip, felt preset): 24 (`#1d0432` L48, `#f2eae8` L48, `#d6ba80` L48, `#1a1008` L48, `#1d0432` L50, `#0a0414` L54, …)

### Bucket (c) — third-party brand, unchanged (17)

- components/GoogleSignInButton.tsx — Third-party brand button: 4 (`#FFC107` L122, `#FF3D00` L126, `#4CAF50` L130, `#1976D2` L134)
- components/InstagramSignInButton.tsx — Third-party brand button: 9 (`#dadce0` L78, `#3c4043` L78, `border-[#` L78, `text-[#` L78, `#fdf497` L91, `#fdf497` L92, …)
- features/friends/FriendLinkDialog.tsx — WhatsApp and Facebook share colours: 4 (`#25D366` L146, `text-[#` L146, `#1877F2` L151, `text-[#` L151)

### Bucket (d) — neutral or unmapped, unchanged (118)

- app/globals.css — Neutral black shadow or scrim: 45 (`rgb(0 0 0 / 0.22)` L56, `rgb(8 4 20 / 0.28)` L894, `rgb(0 0 0 / 0.75)` L1329, `rgb(0 0 0 / 0.45)` L1335, `rgb(0 0 0 / 0.45)` L1373, `rgb(0 0 0 / 0.07)` L1540, …)
- app/globals.css — Neutral white highlight, near-white glyph, or scrim: 12 (`rgb(255 255 255 / 0.65)` L227, `rgb(255 252 250 / 0.65)` L838, `rgb(255 252 250 / 0.75)` L849, `rgb(255 255 255 / 0.5)` L893, `rgb(255 255 255 / 0.9)` L1556, `rgb(255 255 255 / 0.12)` L1560, …)
- app/globals.css — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 11 (`#7c2119` L505, `to-[#` L505, `#7c2119` L638, `to-[#` L638, `#d9f7e3` L1701, `#ffe1e1` L1705, …)
- app/profile/page.tsx — Neutral black shadow or scrim: 3 (`rgb(0 0 0 / 0.12)` L959, `rgb(0 0 0 / 0.12)` L959, `#000` L975)
- app/profile/page.tsx — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 5 (`rgb(168 100 255 / 0.55)` L969, `rgb(80 200 220 / 0.32)` L969, `rgb(200 80 180 / 0.28)` L969, `rgb(80_200_220_/_0.45)` L976, `rgb(210_236_255_/_0.7)` L976)
- app/theme.css — Neutral black shadow or scrim: 10 (`rgb(0 0 0 / 0.55)` L18, `rgb(0 0 0 / 0.45)` L19, `rgb(0 0 0 / 0.4)` L21, `#000` L54, `#000` L55, `#000` L57, …)
- app/theme.css — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 1 (`rgb(80 200 220 / 0.2)` L82)
- components/ChatPanel.tsx — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 4 (`#f4eeec` L60, `#e8ddd9` L60, `from-[#` L60, `to-[#` L60)
- components/PotBanner.tsx — Neutral black shadow or scrim: 1 (`rgba(0,0,0,0.55)` L20)
- components/SeatFriendMenu.tsx — Neutral black shadow or scrim: 1 (`rgba(0,0,0,0.55)` L181)
- components/SeatView.tsx — Neutral black shadow or scrim: 4 (`rgba(0,0,0,0.5)` L350, `rgba(0,0,0,0.55)` L421, `rgba(0,0,0,0.45)` L536, `rgba(0,0,0,0.45)` L598)
- components/SeatView.tsx — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 6 (`#efe6e4` L374, `bg-[#` L374, `#efe6e4` L545, `bg-[#` L545, `#efe6e4` L609, `bg-[#` L609)
- components/SocialNotificationHost.tsx — Neutral white highlight, near-white glyph, or scrim: 1 (`rgb(255_255_255/0.65)` L184)
- components/TableShell.tsx — Neutral black shadow or scrim: 1 (`rgba(0,0,0,0.65)` L69)
- components/ToastViewport.tsx — Neutral white highlight, near-white glyph, or scrim: 1 (`rgb(255_255_255/0.65)` L40)
- components/TurnTimer.tsx — Neutral white highlight, near-white glyph, or scrim: 1 (`rgba(255,255,255,0.12)` L145)
- components/TurnTimer.tsx — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 3 (`#5a2a7a` L45, `to-[#` L45, `#f87171` L153)
- components/ui/StatusChip.tsx — Unmapped decorative or near-miss pigment (no designer role, not an exact token): 4 (`#FFF4D6` L15, `#6B4E00` L15, `bg-[#` L15, `text-[#` L15)
- features/admin/CardLayoutEditor.tsx — Neutral black shadow or scrim: 1 (`rgba(0,0,0,0.35)` L127)
- features/progress/HandsMap.tsx — Neutral black shadow or scrim: 2 (`rgb(0_0_0_/_0.4)` L98, `rgb(0_0_0_/_0.28)` L337)
- features/progress/LevelNode.tsx — Neutral black shadow or scrim: 1 (`rgb(0_0_0_/_0.35)` L44)

### Needs another look

None.

## Contrast exceptions (palette on)

These two pairs miss the threshold with the designer values. They are listed in `scripts/check-contrast.ts` and the suite fails if any other pair regresses.

| Pair | Ratio | Need | Suggested fix |
| --- | --- | --- | --- |
| Classic `--ds-success-text` `#1d7a4d` on page `#e8dad8` | 3.92:1 | 4.5:1 | Darken success text for the rose page, or use it only on card (`#fbf7f4`), where it passes. Status: from source. |
| Arcade focus `#ff2e9a` on page `#ffd93b` | 2.49:1 | 3:1 | Darken the neon pink or outline it against aubergine. Status: new proposal. |
