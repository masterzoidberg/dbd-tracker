# Survivor Items & Add-ons — Export Report

Generated 2026-10-13 from the canonical 10.2.0 dataset and the source archive `G:\Projects\dbd-tracker\images\updated-images`.

## Status

**COMPLETE — ALL 92 ASSETS EXPORTED**

## Counts

- Items: expected **38** / successful **38**
- Add-ons: expected **54** / successful **54**
- Total: expected **92** / successful **92**

## Overall

- expected items: **38**
- exported items: **38**
- missing items: **0**
- ambiguous items: **0** (each canonical entity resolved to exactly one source via the spec rules)
- destination conflicts: **0**

- expected add-ons: **54**
- exported add-ons: **54**
- missing add-ons: **0**
- ambiguous add-ons: **0**
- destination conflicts: **0**

- expected total: **92**
- successful total: **92**

## Per-family

| Family | Items Expected | Items Exported | Add-ons Expected | Add-ons Exported | Problems |
|---|---:|---:|---:|---:|---:|
| Key | 3 | 3 | 5 | 5 | — |
| Firecracker | 3 | 3 | 0 | 0 | — |
| Flashlight | 7 | 7 | 14 | 14 | — |
| Fog Vial | 3 | 3 | 5 | 5 | — |
| Map | 4 | 4 | 5 | 5 | — |
- Med-Kit | 8 | 8 | 14 | 14 | —
| Toolbox | 10 | 10 | 11 | 11 | — |

## Missing

*(none)*

## Ambiguous

Zero canonical entities required ambiguous resolution. Every entity resolved to a unique best source via:
- Exact filename match, OR
- Verified name-variant rule from spec text (Needle & Thread, Abdominal Dressing, Worn-Out Tools), OR
- Verified alias from canonical dataset (Anniversary Flashlight = Fourth Year Flashlight, etc.), OR
- Hyphen-vs-space / `_s`-vs-`'s` formatting normalisation, OR
- **Verified historical/marketing-name reconciliation** (Festive Toolbox = Lunar Toolbox, see Reconciliation section).

Note: 90 entities returned two source candidates (the raw 256×256 plus the `With Backgrounds/` mirror). These were disambiguated by the spec preference for raw artwork — not ambiguity in identity.

## Destination conflicts

*(none)*

## Reconciliation: Lunar Toolbox → Festive Toolbox

The canonical 10.2.0 dataset lists `toolbox/festive-toolbox` (Festive Toolbox) as a current item, but no PNG in the source archive was named "Festive Toolbox" or matched any accepted filename variant. An exhaustive case-insensitive search across the entire archive for filenames containing "festive" or "festiv" returned zero matches.

`G:\Projects\dbd-tracker\images\updated-images\Items and Add-ons\Toolboxes\Lunar Toolbox.png` was identified as the corresponding archive asset based on verified current-canonical-item identity and historical/event naming evidence. The raw 256×256 RGBA PNG was copied to the canonical destination `G:\Projects\dbd-tracker\images\survivor-items-addons\toolbox\items\festive-toolbox.png` (SHA-256 `26f162d2135efe2f58dc708ebe46c4210c46802aab755d7ad1e0c716e006e08d`).

- Canonical name preserved as **Festive Toolbox** — not renamed to Lunar Toolbox.
- **No second independent canonical item** was created for "Lunar Toolbox". The archive terminology "Lunar Toolbox" is recorded as historical/marketing provenance in the manifest `notes` field, but the canonical name remains Festive Toolbox.
- `matchMethod` recorded as `verified-historical-or-marketing-name` (per the targeted reconciliation spec).
- `matchConfidence` recorded as `verified`.
- The source archive file `Lunar Toolbox.png` was NOT renamed, moved, deleted, or modified. Only the canonical destination copy was created.

## Name variations

Source filenames that differ from the canonical name. Match method shows whether the variant is exact-name, verified-alias, verified-name-variant, or verified-historical-or-marketing-name.

| Canonical name | Source filename | Match method |
|---|---|---|
| `Festive Toolbox` | `Lunar Toolbox.png` | `verified-historical-or-marketing-name` |
| `Will O' Wisp` | `Will O Wisp.png` | `verified-name-variant` |
| `Apprentice's Fog Vial` | `Apprentice_s Fog Vial.png` | `exact-name` |
| `Artisan's Fog Vial` | `Artisan_s Fog Vial.png` | `exact-name` |
| `Vigo's Fog Vial` | `Vigo_s Fog Vial.png` | `exact-name` |
| `Emergency Med-Kit` | `Emergency Med Kit.png` | `verified-name-variant` |
| `Ranger Med-Kit` | `Ranger Med Kit.png` | `verified-name-variant` |
| `All Hallows' Eve Lunchbox` | `All Hallows Eve Lunchbox.png` | `verified-name-variant` |
| `Anniversary Med-Kit` | `Anniversary Med Kit.png` | `verified-name-variant` |
| `Banquet Med-Kit` | `Banquet Med-kit.png` | `verified-name-variant` |
| `Masquerade Med-Kit` | `Masquerade Med Kit.png` | `verified-name-variant` |
| `Worn-Out Tools` | `Worn-Out Toolbox.png` | `verified-name-variant` |
| `Mechanic's Toolbox` | `Mechanic_s Toolbox.png` | `exact-name` |
| `Alex's Toolbox` | `Alex_s Toolbox.png` | `exact-name` |
| `Engineer's Toolbox` | `Engineer_s Toolbox.png` | `exact-name` |
| `High-End Sapphire Lens` | `High End Sapphire Lens.png` | `verified-name-variant` |
| `Needle & Thread` | `Needle and Thread.png` | `verified-name-variant` |
| `Abdominal Dressing` | `Abdominal Dressings.png` | `verified-name-variant` |
| `Anti-Exhaustion Syringe` | `Anti-Haemorrhagic Syringe.png` | `verified-alias` |

## Match method totals

| Match method | Count |
|---|---|
| `exact-name` | 79 |
| `verified-name-variant` | 11 |
| `verified-historical-or-marketing-name` | 1 |
| `verified-alias` | 1 |
| **Total successful** | **92** |

## Quality

### Dimensions of exported files

| Dimension | Count |
|---|---:|
| 256x256 | 91 |
| 300x300 | 1 |

### Transparency

| Category | Count |
|---|---:|
| with alpha | 92 |

### Raw 256×256 vs fallback

- Raw 256×256 images used: **91**
- Non-256×256 images required: **1** (1 entity — Refined Serum — no raw in source)
- `With Background` assets used: **1**

The 1 fallback entity is `med-kit/refined-serum` (Refined Serum). The source archive contains only the `With Backgrounds/Medkits/Refined Serum.png` (300×300). No raw 256×256 exists. Per spec §SOURCE IMAGE PREFERENCE order #3: used the framed variant only because no raw equivalent exists.

## Source archive unchanged

Verified before export: 4,170 PNGs in `G:\Projects\dbd-tracker\images\updated-images`.
Verified after export:  4,170 PNGs in `G:\Projects\dbd-tracker\images\updated-images`.

Source archive file count and ordering unchanged. No source file was renamed, moved, modified, or deleted. In particular:
- `Lunar Toolbox.png` was NOT renamed, deleted, moved, or modified. It still exists at its original source path. Only the canonical destination copy `festive-toolbox.png` was created.

## Confirmations

- Folder root: `G:\Projects\dbd-tracker\images\survivor-items-addons` — ✅ exists
- Path report: `G:\Projects\dbd-tracker\images\survivor-items-addons\survivor-items-addons-path-report.md` — ✅ exists
- Manifest JSON: `G:\Projects\dbd-tracker\images\survivor-items-addons\survivor-items-addons-image-manifest.json` — ✅ exists
- Manifest CSV: `G:\Projects\dbd-tracker\images\survivor-items-addons\survivor-items-addons-image-manifest.csv` — ✅ exists
- Export report: `G:\Projects\dbd-tracker\images\survivor-items-addons\survivor-items-addons-export-report.md` — ✅ exists (this file)