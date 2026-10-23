# Palette v2 rollout

The redesign colours live in `app/theme.colours.generated.css`. They apply only when `<html data-palette="v2">` is set. Radius, shadow offsets, blur, and type stay in `theme.css`.

## Flag

| Control | Effect |
| --- | --- |
| `NEXT_PUBLIC_PALETTE_V2=1` | On for that build |
| `NEXT_PUBLIC_PALETTE_V2=0` | Off, including preview |
| unset, `VERCEL_ENV=preview` | On |
| unset otherwise (production) | Off |
| `?palette=v2` | On, and stored in `localStorage` `pokr-palette` |
| `?palette=v1` | Off, and stored the same way |

The attribute is set before paint from `app/layout.tsx`. `applyPaletteOverride()` in `AppChrome` repeats the query and storage override after hydration.

## Rollback

Before the cleanup that deletes the baseline triplets:

1. Set `NEXT_PUBLIC_PALETTE_V2=0` and redeploy the env, or
2. Open `?palette=v1` on a client that has saved `v2`.

No code revert is required. The previous triplets stay in the generated file under the original selectors.

After a cleanup PR removes the flag, roll back by reverting that PR. Tag the pre-cleanup commit `pre-palette-v2` before merging it.

## Review

Open Classic, Arcade, and Glass with `?palette=v2` and `?palette=v1`. Geometry is checked by `npm run test:palette -w @poker/web` (Playwright). Signed-in routes, a seeded `/table/[id]`, and room routes need `E2E_STORAGE_STATE` plus the API; without it those cells are skipped. The gallery is written to `apps/web/e2e/palette-gallery/` and is not committed.

## Known gaps

- G1. Glass brand is gold. `--bg-chrome` uses aubergine `#2b0b4a`, not gold.
- G2. Glass page is a gradient. The triplet slot is flat `#2b0b4a`. `--g-page` holds the gradient and is not wired, because the page already paints a different aurora.
- G3. Glass frost panels switch to the dark card and light text only while the flag is on.
- G4. Arcade `--brass` follows the red accent. Money still uses `brass`, so amounts go red in Arcade. `--ds-gold*` stays gold for a follow-up. Chip faces are unchanged.
- G5. `--text-muted` maps to `text_secondary`. `--ds-text-muted` is the caption tier and is not wired.
- G6. Patina, card faces, and felt rim edge stay.
- G7. The nine felt presets are unchanged. Ask before pointing preset 0 at the designer felt.
- G8. Dark HUD text uses white and `#c4b2d6`. There is no Classic role for that surface.

Android is deferred. The Expo app should read these JSON files later.

## Contrast

Two designer pairs miss AA and are the only misses the suite allows:

- Classic success text `#1d7a4d` on page `#e8dad8` is 3.92:1. Darken it, or use it on card only.
- Arcade focus `#ff2e9a` on page `#ffd93b` is 2.49:1. Darken the pink.

They are not designer-approved exceptions yet.
