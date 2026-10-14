# M07A — Perk Artwork / optional M07B — Portraits

## Goal, scope and dependencies

M07A adds perk recognition with a small generated manifest/resolver, fixed fallback and unchanged save data. M02 build/stage pipeline and complete Filtering precede it; [asset review](asset-review.md) and [inventory](asset-audit.json) supply exact evidence. M08 needs M07A, never portraits.

M07A is **perk icons only**. Source images are not renamed, modified, cropped or re-encoded. CSS normalization only. No image paths in saves. M07B portraits are optional/later and own portrait naming exceptions, 17 misleading WebP extensions and normalization. Shared perk background deferred.

## Current behavior and implementation points

No runtime image resolver; detailed tables use neutral diamond. Inventory: 282 icon files, 39 missing perk files, three Cenobite matches are identical placeholders, leaving 279 usable icons/42 fallback perks. 85 portraits/13 missing are separate. All 17 misleading extensions are portraits. server.js lacks image MIME entries; catalogs already bundled.

Likely M07A files: scripts/generate-assets.mjs, generated data/asset-manifest.json, small src/assets.js, existing catalog exports, src/app.js perk table/detail, styles.css, build/release scripts/package wiring, focused tests/assets.test.js and staged image specs. server.js PNG response may be corrected if required for localhost icons. No portrait UI/build packaging in M07A, no source image edits.

## Manifest and resolver

Scan actual perk PNG paths by role and basename through canonical IDs/perkAliases plus Detective's Hunch asset exception. Do not derive paths from current display names or create a 321-entry hand map. Small manifest maps canonical ID to relative usable path/metadata or null. Detect collisions/invalid paths/unsupported headers and fail generation; legitimate known/future missing icons null. Sorted output, no timestamps; no save/catalog ID changes.

Use audited content hash to exclude three Cenobite placeholders intentionally: no-holds-barred -> deadlock, hex-fortunes-fool -> hex-plaything, scourge-hook-weeping-wounds -> scourge-hook-gift-of-pain. Authentic future replacement bytes can become eligible; avoid permanently disabling canonical IDs. detectives-hunch filename maps to detective-s-hunch canonical ID.

Bundle generated manifest into dist/app.js with esbuild; no fetch/runtime JSON dependency, preserving file://. Resolver returns document-relative images/... or null. Same generated input feeds release allowlist; copy only non-null referenced usable icons, no portraits/background/ZIP/placeholders.

## Generation/test/build order — Option B

Asset tests invoke/test generator directly against current tree and isolated fixtures, never pre-existing generated JSON. npm run release runs source/domain/asset tests -> regenerates required build manifest -> fresh build -> clean stage -> references/assets verification -> staged browser tests -> optional Windows ZIP. Standalone build also regenerates before esbuild. Fail generation rather than consuming stale output.

“Generated asset data used by tests/build/release must be reproducible from the current asset tree and must not depend on stale workspace output.” Absent or deliberately stale manifest must not affect tests; build/release replace it from current inputs. Tests and release share generator logic, not cached output. No deterministic ZIP requirement.

## Presentation and failures

Fixed icon slot approximately 36px in Detailed, later reused by Compact. Icon+readable name remains one native detail action; empty alt avoids repeating adjacent name. CSS object-fit/normalization preserves source bytes. Known null emits fallback only; no missing URL request. Unexpected load/decode error removes/hides failed img and retains fixed neutral diamond slot without loops/broken browser icon. Browser error fallback is defensive backup, not primary missing-asset detection. Lazy loading/async decoding where appropriate; no layout shift or extra focus target.

Missing/bad image never disables edits. Alias/display-name changes select same canonical icon. Invalid/ambiguous generation fails before verified release; no broad download/generation/image pipeline.

## Milestone-owned tests and steps

- [ ] Generator current-tree/fixture tests: roles/canonical aliases/Detective's Hunch, collision/path/header failure, missing null and placeholder hash exclusion.
- [ ] Baseline 282 filename matches minus three placeholders = 279 usable references; 39 missing +3 unusable =42 fallbacks. Recompute only if current inputs legitimately change.
- [ ] Resolver/name-setting invariance, no paths added to saves; repeated same-tree generation same manifest.
- [ ] Absent/stale workspace manifest cannot influence tests/build/release; generator failure aborts pipeline. Extend M02 packaging tests here.
- [ ] Known null fallback requests no asset; intentionally broken usable URL triggers fixed runtime fallback without loop.
- [ ] Staged real icons decode (naturalWidth >0) on file/localhost/offline; verify all referenced staged usable icons, accounting for lazy loading rather than only initially visible rows.
- [ ] Implement generator/build integration, resolver/slot/fallback and exact usable-icon staging; run own tests plus release/M09 gate.

## Optional M07B and deferred background

Separate optional deliverable: portraits with nine naming exceptions, 17 WebP-under-PNG filenames and common CSS normalization. Before integration, choose bounded format-extension handling for those portraits, preserve image bytes and test MIME/decode on file/static host/localhost. No source image change is authorized by this plan rewrite; any future extension handling belongs solely to M07B. Small portrait region/fallback must preserve existing controls/card density. It owns portrait tests and release references when included. It does not block Compact or either core cut. Shared background remains deferred.

## Acceptance, manual verification and rollback

M07A canonical resolver, missing/placeholder exclusion, decode/fallback and packaging pass. Source image hashes/names unchanged, no paths in saves, all referenced staged usable icons decode, file/localhost work. No portraits required.

Check Detective's Hunch, original/generic licensed aliases, all three Cenobite fallbacks and missing icons at 500/700/900 plus desktop. Break a usable path in disposable stage and confirm stable fallback/editing. Revert rendering/generator/build/stage integration together and rebuild, no save migration. Risks: wrong aliases, stale manifest, placeholder inclusion, layout shift; exact generator fixtures and staged decode address them. Exit: M07A passes, M07B explicitly optional, M08 ready.
