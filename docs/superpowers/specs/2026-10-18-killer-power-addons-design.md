# Killer Power & Add-ons Design

**Status:** Approved in conversation; written specification awaiting review
**Date:** 2026-10-18

## 1. Goal

Make the existing Killer Power & Add-ons workspace a useful reference and inventory page. The Power establishes context at the top of the page, while the full Add-on pool remains the main interactive inventory content. Users can review Power and Add-on details and record quantities without changing the current save format or online/offline behavior.

This feature is an inventory and reference view. It does not calculate Power changes, recommend builds, or validate Add-on combinations.

## 2. Verified Repository and Data Baseline

### Canonical research data

- `data/dbd-killers-live-10.2.1.json` is the combined, versioned source for Killer Power and Add-on research. It is the sole research authority for this feature.
- The catalog contains 44 Killers and 880 Add-ons: 20 Add-ons for each Killer. Each Killer has 4 Common, 5 Uncommon, 5 Rare, 4 Very Rare, and 2 Ultra Rare Add-ons.
- Power and Add-on records are marked VERIFIED. Add-on IDs and research IDs are unique, and each Add-on has an explicit Killer owner.
- Power records contain a name and short summary as well as full explanation, components, mechanics, resources, Survivor interactions, Power states, Add-on-relevant mechanics, complex rules, baseline facts, changes, verification notes, sources, and artwork metadata. Add-on records contain identity, ownership, rarity, effect text, research metadata, and artwork metadata.
- The working copy of the canonical file already contains targeted artwork metadata corrections: 131 stored paths and their 131 `artwork.filename` values now match exact tracked filenames. Mechanical comparison confirmed the corrections changed artwork metadata only; canonical names, IDs, research IDs, rarity, effect, ownership, and other identity/research fields were preserved. This specification does not rewrite or normalize that file.

### Artwork audit

The tracked artwork tree is `images/Powers and Add-ons/`. After the targeted corrections, validation found:

| Mapping result | Count |
| --- | ---: |
| Non-null paths checked | 917 |
| EXACT paths resolved | 843 |
| REVIEW paths resolved | 74 |
| Explicit null Power mappings | 7 |
| Unresolved or invalid mapped paths | 0 |

EXACT and REVIEW paths both resolve to tracked artwork and pass the normal path, symlink, PNG, and dimensions checks. REVIEW records the confidence of a human-selected mapping; it does not make otherwise valid art unsuitable for display. The seven null Power mappings are intentional and use an accessible fallback. Invalid explicit paths must fail asset validation; the application must not guess a replacement filename.

### Existing application patterns

- `src/character-workspace.js` already defines the role-correct Killer `power-addons` route. `src/app.js` currently renders this route as unavailable; the feature fills that reserved workspace.
- The application bundles its runtime data and assets for offline use. `scripts/build.mjs` regenerates `data/asset-manifest.json` before bundling. `scripts/release.mjs` stages manifest-referenced artwork and verifies the staged assets.
- `scripts/generate-assets.mjs` already validates explicit asset paths and PNG files. The existing art tree can be consumed directly; a duplicate curated art directory is unnecessary.
- The app already has a native `#detail` dialog pattern. The Survivor inventory renderer is specific to Survivor item families, but `src/inventory-interaction.js` provides reusable quantity interaction helpers.
- `src/inventory-quantities.js` and the schema-v2 model already support namespaced Killer Add-on quantities, zero omission, preservation of unknown correctly namespaced IDs, and rejection of known Add-ons assigned to the wrong Killer. Existing direct-save inventory interactions also define validation, Enter/blur commits, +/- controls, error handling, and focus recovery.
- Existing tests cover schema-v2 inventory validation and storage behavior. Killer Power & Add-on rendering and the associated asset/release integration are not yet implemented.

The October 16 Killer Add-ons design and implementation plan are historical context where they conflict with the repository now. In particular, their separate Power and Add-on sources, 720-Add-on dataset, `images/updated-images/...` path, and second curated artwork tree are superseded by the combined master and tracked artwork findings above.

## 3. User Experience

### Power panel

At the top of the Killer Power & Add-ons page, show a wide Power panel containing:

- Power artwork when an explicit valid mapping exists; otherwise, the accessible Power artwork fallback.
- The Power name and short summary, visible by default.
- A Power Details action that opens the existing native `#detail` dialog.

The details view may present the full explanation, components, mechanics, resources, Survivor interactions, Power states, Add-on-relevant mechanics, and complex rules when those fields are available. It must keep this information readable without turning the default panel into a dense mechanics sheet. Do not expose research sources, verification notes, patch history, or other research-only fields in the interface.

### Add-on inventory

Show all 20 Add-ons beneath the Power panel, grouped in canonical rarity order: Common, Uncommon, Rare, Very Rare, and Ultra Rare. Keep all five headings visible and all groups expanded. Preserve source order within each rarity group.

Each Add-on card shows its artwork, name, rarity, quantity controls, and a Details action. The Details action opens the existing `#detail` dialog and presents the full Add-on effect there. Show zero-quantity Add-ons as well as stocked ones.

Do not add search, an In Stock toggle, collapsible rarity groups, card-size controls, or invented functional categories in v1. The full pool and its five short rarity groups provide the intended reference and scan structure.

## 4. Runtime Data Architecture

Generate a deterministic, compact Killer runtime catalog from `data/dbd-killers-live-10.2.1.json`. A derived `data/killer-runtime-catalog.json` keeps the rich research source out of the application bundle while allowing the app to continue using statically bundled data offline. The normal build must regenerate the projection and check that it is current with the canonical input. Generate it before asset generation when necessary so asset generation consumes the same runtime registry used by the application.

The runtime projection includes only fields required by the page, quantity validation, and asset validation:

- Power identity for the owning `characterId`, Power name, short summary, explicit artwork path and confidence, and the approved gameplay-detail fields: full explanation, components, mechanics, resources, Survivor interactions, Power states, Add-on-relevant mechanics, and complex rules.
- Add-on ID, explicit owning `characterId`, name, canonical/source display order, rarity, effect text, explicit artwork path, and artwork confidence.

Do not project research sources, verification notes, provenance, patch history, aliases or notes unless a demonstrated runtime behavior requires one of those fields. Do not create a second source of truth or infer Add-on ownership from names, order, or artwork. The master’s explicit IDs and `characterId` remain authoritative.

## 5. Artwork and Release Behavior

- Resolve artwork only from explicit paths in the canonical master under `images/Powers and Add-ons/`.
- Extend the existing asset manifest allowlist and checks for this tracked root, using the current path, symlink, PNG, and release validation patterns.
- Render both EXACT and REVIEW mappings normally when their explicit paths pass validation. Keep confidence available to source/runtime validation and audit tests; do not show confidence badges in the UI.
- Use the accessible fallback for the seven explicit null Power mappings.
- Any invalid or nonexistent non-null mapping fails asset generation. Do not substitute another path, derive a filename from a display name, or silently fall back for an invalid mapping.
- Do not copy or duplicate Killer art into another directory. Release output stages only artwork paths explicitly referenced by the generated manifest.
- Keep the canonical research master out of the runtime bundle. No runtime catalog fetch or external asset request is introduced.

## 6. Quantity and Save Compatibility

Use the existing per-character save location, `characters[characterId].inventory.addons`, and keep `schemaVersion` at 2. A missing entry represents zero; zero is omitted from persisted maps. The page nevertheless displays all 20 catalog entries, including entries whose quantity is zero.

Reuse the shared quantity interaction behavior where it fits the Killer page while preserving the established direct-save interaction: valid Enter and blur commits, increment/decrement controls, quantity validation, writer/error handling, pending input behavior, and focus recovery. Do not force the Survivor family-specific renderer or add Survivor compatibility rules to Killer Add-ons.

Known Add-ons must remain assigned to their explicit owning Killer. Reject a known Add-on quantity on the wrong Killer. Preserve unknown correctly namespaced `killer-addon-*` IDs according to existing schema-v2 behavior. Do not change model or storage production code unless implementation tests show a specific existing gap.

## 7. Build, Validation, and Release Expectations

Implementation validation should cover:

- Deterministic runtime projection and detection of a stale projection.
- The complete canonical data shape: 44 Killers, 880 Add-ons, exactly 20 per Killer, expected rarity distribution, unique IDs, and explicit correct ownership.
- Inclusion of the approved Power gameplay details and exclusion of research-only fields from the runtime projection.
- Explicit validation of every non-null artwork mapping, including successful EXACT and REVIEW mappings, the seven null Power fallbacks, and failure for invalid paths. The current audit baseline is 917 mapped paths: 843 EXACT, 74 REVIEW, 7 null Power mappings, and zero unresolved paths.
- Quantity persistence, zero omission, unknown namespaced-ID preservation, wrong-Killer rejection, and schema-v2 save compatibility.
- Power Details and Add-on Details interactions, display of all 20 zero-or-stocked Add-ons, rarity grouping/order, keyboard use, and responsive layout.
- Release staging of only manifest-referenced Killer art, correct staged asset validation, offline/local-only runtime behavior, and existing Survivor inventory regressions.

Do not change the Survivor catalog or inventory behavior as part of this feature except where a shared regression test demonstrates an unintended effect.

## 8. Scope Boundaries

This design does not include Add-on search or filtering, stocked-only views, collapsible rarity sections, strategy categories, builds or loadouts, Add-on synergy or compatibility calculations, modified Power-stat calculations, online data loading, visible confidence labels, save-schema changes, or a second artwork store.

The approved design leaves implementation details such as component boundaries, exact DOM markup, generated-catalog validation mechanics, and test organization to the implementation plan and repository conventions.
