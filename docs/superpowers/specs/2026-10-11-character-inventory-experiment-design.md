# Character Inventory Experiment

## Purpose

Add an isolated, reversible character-level inventory experiment that uses the existing progression selectors and persistence path. The normal experimental view shows only effective tracked inventory; its Update Inventory workspace shows a purpose-built candidate pool for visual reconciliation against Dead by Daylight.

## Scope and isolation

- Add `#experiment/<character-id>` for the experimental inventory view.
- Add `#experiment/<character-id>/update` for reconciliation.
- Keep `#manage/<character-id>`, account-wide perk libraries, the save schema, migrations, and progression rules unchanged.
- Reuse `commit()` and existing personal/historical tier mutation functions.
- Keep session-only changed markers in memory; never serialize them.

## Domain rule

For a canonical role perk, include it once in the Update candidate pool when at least one of these is true:

1. The character's canonical `nativePerkIds` contains the perk ID.
2. The perk is marked `general`.
3. `globalTier(save, perk) > 0`.
4. `inventoryTier(save, characterId, perk.id) > 0`.

Primary category precedence is Personal, General, Unlocked, then retained-only exception. Retained-only candidates are visible in All and labeled `Retained on this character`; they are not forced into a misleading visible category tab.

Secondary provenance exposes Prestige, Shrine, Legacy, manual account unlock, and retained/personal context where applicable. Native membership is based on the character relationship, not source-character string equality.

## Tier correction

- Card color and Roman numeral represent `inventoryTier` (effective tier).
- The editor separately shows recorded tier and automatic minimum.
- Non-historical direct controls select Not recorded, I, II, or III. Not recorded removes the personal record and preserves automatic minimums. Options below the automatic minimum are disabled and rejected by the experiment mutation helper.
- Historical/manual-ownership perks retain the existing confirmed/explicit-zero semantics and downgrade protections through a dedicated select control.
- All edits save immediately through the existing storage/EditorGuard path.

## UI

- Reuse one icon-first perk card renderer for normal inventory and Update mode.
- Normal view has no filters; it shows only `inventoryTier > 0`, a concise tracked/maxed summary, and an Update Inventory action.
- Update mode has Search perks…, All, Personal, General, Unlocked, and Only unrecorded. Only unrecorded means effective tier `=== 0` within the candidate pool.
- Cards show large artwork, a CSS-generated tilted-square frame, perk name, explicit effective tier, provenance, unrecorded state, selected state, and Changed this update when applicable.
- Responsive CSS controls column count; no Detailed/Compact toggle.
- `perk_background2.png` remains unused because the existing asset is a small distressed dark frame and a CSS frame gives clearer tier-specific treatment without altering source PNGs.

## Testing

Add focused unit tests for candidate membership, category precedence, deduplication, historical/retained exceptions, unrecorded filtering, direct tier safety, transient session state, and normal-view effective inventory selection. Run the existing full Node suite, build, and browser smoke verification after implementation.

## Audit targets

Using `data/dbd-tracker-2026-10-05-1502.json`, the expected candidate audit before UI filtering is Doctor 24 (Personal 3, General 19, Unlocked 2, retained-only 0) and Cenobite 22 (Personal 3, General 16, Unlocked 3, retained-only 0). The Cenobite's three native perks are also catalog-marked General; Personal precedence keeps them Personal and the overlap is reported as a domain wrinkle.
