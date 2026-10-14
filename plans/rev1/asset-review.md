# Exact asset review

Inventory taken 2026-10-06 from the repository, not inferred from naming examples. [asset-audit.json](asset-audit.json) contains **every path, byte size, format, dimensions and SHA-256**, every canonical character/perk association, missing entries and duplicate-content groups. Regenerate from root with `node plans/rev1/audit-assets.mjs` (Node 22). This script only writes the planning JSON; it does not rename, modify, decode/re-encode or integrate assets.

## Counts and actual encodings

| Directory | Image files | Other files | Catalog matched | Missing |
|---|---|---|---|---|
| images/killer-images | 40 | 0 | 40 of 44 characters | 4 |
| images/survivor-images | 45 | 0 | 45 of 54 characters | 9 |
| images/killer-perks | 133 | killer-perks.zip | 133 of 145 perks | 12 |
| images/survivor-perks | 149 | survivor-perks.zip | 149 of 176 perks | 27 |
| images/perk_background2.png | 1 | 0 | Shared background | N/A |

Total: **370 files, 368 images, 2 archives**. 351 real PNG, 17 real WebP all misnamed `.png`. PNG dimensions: 56 portraits at 73×101, 12 portraits at 73×73, 283 assets at 87×87 (282 perk icons plus shared background). WebP: 17 portraits at 512×512. No unmatched image remains after the small character exception set and Detective's Hunch filename exception. No duplicate canonical mapping candidates or duplicate portrait content found. Dimensions determined from PNG IHDR/WebP VP8X headers; not a complete decoder/visual-quality check of every file.

WebP-under-PNG filenames:

- Killer: animatronic.png, charles_lee_ray.png, danny_johnson.png, dark_lord.png, frank_julie_susie,_joey.png, ghoul.png, houndmaster.png, jeffrey_hawk.png, nemesis_t-type.png.
- Survivor: ash_williams.png, bill_overbeck.png, david_tapp.png, jeff_johansen.png, lara_croft.png, taurie_cain.png, trevor_belmont.png, troupe.png.

`server.js` currently has no image MIME entries and sends application/octet-stream + charset for unknown extensions. M07A may add correct PNG responses if needed for usable perk icons. All 17 misleading extensions are portraits, outside M07A. Optional/later M07B must resolve their format/extension/MIME handling and verify decode across file/static-host/localhost, preserving bytes. Any bounded extension correction belongs there, not the core icon release. No source image modification in M07A or this rewrite.

## Naming and mapping

Portraits use underscore-separated names, killer titles without `the-`, occasional person names and damaged/abbreviated names. Perk parent folders use source slugs without killer `the-`; icons use mostly canonical perk basenames. Deterministic resolver should **scan actual paths**, not invent paths from source display names. Role + canonical icon ID is sufficient; parent folders are presentation inventory, not save identifiers.

Portrait matching: normalize basename with existing catalog `slug`; canonical character ID stripped of leading `the-`. This resolves 76 of 85 supplied portraits. These nine exceptions resolve the remainder:

| Canonical ID | Actual portrait stem |
|---|---|
| the-ghost-face | danny_johnson |
| the-clown | jeffrey_hawk |
| the-legion | frank_julie_susie,_joey |
| the-good-guy | charles_lee_ray |
| the-nemesis | nemesis_t-type |
| the-onryo | onry |
| aestri-yazar | troupe |
| leon-s-kennedy | leon_scott_kennedy |
| elodie-rakoto | lodie_rakoto |

Perk matching: role + actual basename. Of 282 icon files, **278 match canonical IDs directly**, three resolve through existing aliases (`no-holds-barred` -> deadlock; `hex-fortunes-fool` -> hex-plaything; `scourge-hook-weeping-wounds` -> scourge-hook-gift-of-pain), and one asset-only exception (`detectives-hunch` -> **detective-s-hunch**, the catalog's actual canonical ID). Do not rename the canonical ID to a nicer slug; saves already depend on it. Directory exception `elodie-rakoto` and portrait `lodie_rakoto` need no shared directory map if the manifest scans basenames. Bill/Yun-Jin compatibility IDs already match their supplied assets.

## Duplicates and unexpected files

The three Cenobite alias icons listed above share SHA-256 and identical bytes. Visual inspection of no-holds-barred shows a generic skull/question-mark placeholder. They do not provide three distinct recognizable perk icons. Treat all three as intentional missing-art fallback until authentic art arrives; keep canonical perk mappings, but generated runtime manifest returns null for recognized placeholder content. Content-hash exclusion is preferable to globally disabling these IDs forever: a real replacement file should work automatically. These add **3 unusable matches** to the 39 missing files: 42 perks lack useful recognition artwork.

Nested ZIPs are source dumps and must be excluded from runtime staging and its optional ZIP. No source-distribution artifact is required. Do not unpack/download them or use them to infer additional assets during release. No other unexpected standalone files found. The shared background exists at 87×87; its integration is deferred. It is not needed for recognition/fallback and is not part of M07A packaging.

## Missing characters (canonical IDs)

Killer: `the-first`, `the-judgment`, `the-krasue`, `the-slasher`.

Survivor: `aurora-stardotter`, `dustin-henderson`, `eleven`, `kwon-tae-young`, `michonne-grimes`, `orela-rose`, `rick-grimes`, `shane-wiigwaas`, `vee-boonyasak`.

These are missing relative to the **supplied tracker catalog**, not an independently verified statement about the game's live roster.

## Missing perks (canonical IDs)

Killer (12): `celestial-witness`, `hex-hive-mind`, `hex-overture-of-doom`, `hex-scared-to-death`, `hex-under-your-thumb`, `lay-waste`, `rampage`, `ravenous`, `secret-project`, `silent-shadow`, `turn-back-the-clock`, `wandering-eye`.

Survivor (27): `a-place-for-us`, `apocalyptic-ingenuity`, `bada-bada-boom`, `boon-steadfast`, `change-of-plan`, `come-and-get-me`, `conviction`, `cross-examination`, `do-no-harm`, `duty-of-care`, `extrasensory-perception`, `five-moves-ahead`, `flow-state`, `fruits-of-your-labor`, `ghost-notes`, `last-stand`, `lend-a-hand`, `one-two-three-four`, `rapid-response`, `road-life`, `salvations-cry`, `teamwork-full-circuit`, `teamwork-soft-spoken`, `teamwork-throw-down`, `teamwork-toughen-up`, `we-see-you`, `wide-open-throttle`.

## Strategy comparison and recommendation

| Strategy | Fit |
|---|---|
| Direct canonical paths | Insufficient: varied folders, person names, underscores and real format mismatch; filesystem existence unknown at file runtime |
| Deterministic path + exception map | Can guess many paths but still needs known-presence metadata to avoid probing all missing icons; source/name/format cases accumulate |
| Generated manifest + small resolver exception set | **Recommended:** one build-time scan, stable canonical associations, explicit null misses, collision failure, bundled JSON, no runtime fetch |
| Rename/copy every asset to canonical paths | Unnecessary churn; M07A changes no source images. Portrait format handling belongs to optional M07B |

M07A uses a small src/assets.js resolver backed by generated data/asset-manifest.json for **perks only**. Include canonical ID -> relative usable path/metadata or null by role; same freshly generated manifest is bundled in dist/app.js and drives usable referenced-icon staging. No hand-written 321-entry map, portrait entries or source-image changes. Rendering never derives paths from display labels.

Option B: source/asset tests invoke/test generator directly on current tree/fixtures -> release regeneration of required build manifest -> fresh build -> clean stage/reference verification -> browser tests -> optional Windows ZIP. Standalone build regenerates too. Generated asset data used by tests/build/release must be reproducible from current asset tree and must not depend on stale workspace output. No runtime manifest fetch, deterministic ZIP or compulsory source artifact. Keep output sorted/timestamp-free without adding archive determinism machinery.

Known missing/placeholder images resolve to null without requests. Unexpected decode/load error hides failed `<img>` and retains a fixed-size fallback slot; error handler must not request another missing URL or render a broken browser icon. One delegated capture error handler or equivalent small reusable rendering function is sufficient. M07A perk fallback: current neutral diamond; future M07B character fallback: current card/silhouette. Adjacent name provides accessible text; artwork can be alt="" to avoid repeating names. Use CSS object-fit, no destructive crop/re-encoding.
