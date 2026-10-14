# Inventory persistence and character editing

Date: 2026-10-13. Status: finalized for implementation planning. Documentation only; application changes, migrations and tests await implementation. Product decisions include per-character quantities, one combined queue/inventory schema-v2 release, and an explicit Save Character with one draft commit, confirmed by the human during this pass. Technical recommendations preserve the existing canonical save/writer boundary.

## Inventory scope and smallest save shape

Use one per-character `inventory` object with two sparse maps, `items` and `addons`, alongside existing `perks`. This extends the record that already owns Prestige, BW, notes and personal tiers. No shared account stock pool or second storage key. All canonical character records, including preserved unknown character records, have both maps; the unused role map is empty. A uniform container avoids inventing a saved role/discriminator or guessing the role of an unknown imported character.

Survivor Items belong in `inventory.items`; Survivor Item Add-ons and Killer Add-ons belong in `inventory.addons` with separate type namespaces. Known Killer records have empty `items`; known Survivor records accept only Survivor item/add-on identities. Quantity state is character-specific even where every Survivor uses the same catalog. Do not transfer/aggregate stock across characters.

Illustration of added fields within an existing record (other required character/account fields still exist):

```json
{
  "schemaVersion": 2,
  "prestigeQueue": [],
  "characters": {
    "dwight-fairfield": {
      "inventory": {
        "items": { "survivor-item-key-broken-key": 4 },
        "addons": { "survivor-addon-key-blood-amber": 12 }
      }
    },
    "the-trapper": {
      "inventory": { "items": {}, "addons": {} }
    }
  }
}
```

Missing inventory entity IDs mean zero; positive entries only need persistence. Empty maps mean no recorded stock, not evidence that the player audited every catalog entry. No additional “inventory setup complete” flag is needed. Existing `perks` semantics, including explicit historical zero, are unrelated and must not be sparsified by this rule.

Per-character maps fit existing cloning, timestamps, validation, export and backup paths with the fewest ownership joins. A root-level character-keyed inventory object would duplicate the character registry and orphan handling; role-specific record schemas would need unknown-role inference. Three separate quantity maps add no benefit because namespaces distinguish the two add-on types. The proposed two-map container is a technical recommendation, not a new account-wide product model.

## Canonical save IDs and catalog adapter

Keep `safeId` unchanged. Persist immutable lowercase hyphen-token IDs with explicit type namespaces:

| Entity | Namespace |
| --- | --- |
| Survivor Item | `survivor-item-<family-id>-<entity-slug>` |
| Survivor Item Add-on | `survivor-addon-<family-id>-<entity-slug>` |
| Killer Add-on | `killer-addon-<canonical-character-id>-<entity-slug>` |

For the current Survivor manifest, deterministic mapping is prefix by `entityType` plus its existing `family/entity` identity with `/` replaced by `-`. Example: `key/broken-key` → `survivor-item-key-broken-key`; `key/blood-amber` → `survivor-addon-key-blood-amber`. A read-only identity check found 92 entries, 92 unique resulting IDs and none outside the current slug syntax. This is source verification, not an implementation test or catalog modification.

The future catalog adapter owns the explicit source-ID → save-ID map, names, family, compatibility, order, rarity, effects, image paths and version/provenance. Preserve the source manifest's slash IDs and image paths; they do not become saved identifiers. Store definitions once in the bundled catalog. Do not repeatedly derive saved IDs from localized/renamed display labels. Verify source uniqueness and namespace collisions before ingestion; later renames retain the frozen save ID or an explicit alias mapping. No automatic future alias merge of quantities is specified: summing/maxing duplicates could fabricate stock and requires evidence before any such migration.

Killer namespace uses actual `characterById` identity, not Power/asset-folder label. Entity slugs must come from the eventual verified add-on catalog; no current Killer slug list is asserted. Full identity is validated by catalog lookup, not trying to split variable-length hyphenated tokens. For unknown entries validate namespace syntax and preserve the whole ID without guessing owner/family. A syntactically valid unknown Killer ID cannot safely establish compatibility until its catalog definition exists.

## Deterministic validation

V2 requires `prestigeQueue` and an `inventory` object containing object-valued `items` and `addons` on every supplied character record. Known catalog characters absent entirely still receive the existing fresh record defaults, now including empty maps. Missing/malformed inventory on an explicitly supplied v2 record rejects the whole candidate; never silently treat a damaged field as empty.

- Each map is a non-null object, not array/string. Keys satisfy existing `safeId` and the appropriate recognized namespace with nonempty identity suffix. `items` accepts Survivor Item namespace; `addons` accepts Survivor Add-on or Killer Add-on namespace.
- Values are non-negative safe integers, 0 through `Number.MAX_SAFE_INTEGER`. Reject negatives, fractions, NaN/infinity, unsafe numbers, numeric strings, null and booleans. UI requires a nonempty whole-number numeric value; blank is invalid, not zero. Optional decrement clamps at zero; increment disables at the safe maximum. Do not broaden validation based on slash examples.
- Explicit zero is a valid incoming quantity but canonical validation omits that entry. Positive values round-trip exactly. Export/import is semantically canonical, not byte-identical for zeros/object ordering.
- Known character + wrong-role namespace, nonempty Killer `items`, known catalog entity in wrong map, or known Killer add-on belonging to a different Killer rejects the candidate. This mirrors current known wrong-role perk rejection. Unknown character records retain structurally valid maps without guessed role; known entities are still checked for correct map.
- Unknown well-formed IDs in an allowed namespace are retained with quantities and warnings, including on unknown characters. Do not reject merely for catalog absence or prune on catalog change. When later definitions resolve, reapply known compatibility checks; if they reveal incompatibility, fail with an explanatory recovery/import error rather than deleting stock.
- Unknown records are not editable through invented catalog cards. Show an unavailable-record warning/details region on applicable pages and Data & backups; preserve them unchanged through normal edits. Default zero catalog entries remain fully visible; unknown records cannot have fabricated rarity/effect/artwork.
- Malformed IDs, namespace/map mismatch or quantity fields reject the entire candidate with character ID, map, entity/field and useful validation explanation. No partial salvage, coercion or silent dropping. Failed load uses current blocked/recovery behavior; failed import/write leaves old bytes/memory intact.

UI creation/edit validation additionally requires a resolved applicable catalog entity and live writer. Import validation intentionally allows unresolved valid IDs, as it already does for perks/queue. A queue entry alone never creates a character record, known or unknown solely for queue validation; existing known-catalog fresh defaults are separate from that rule.

## Complete schema v2 and migration boundary

The human explicitly approved **one complete v2 release containing queue and inventory**, rather than queue-only v2 immediately followed by v3 for quantities. This extends the previously approved v2 shape: one account `prestigeQueue` plus per-record `inventory.items/addons`, both empty by default. The strict queue validation, order, unknown preservation and older-app rejection decisions remain unchanged.

Updated app accepts valid v1 and complete v2 only. V1 follows current validation/default behavior, existing account-rule normalization/alias consolidation at their already established load/replace entry points, then structural conversion adds `schemaVersion: 2`, `prestigeQueue: []` and `{items:{}, addons:{}}` to each retained/defaulted character record. Unknown v1 character records also receive empty maps without guessed role. Do not create records for unknown queue references. V1 had no supported quantity state; unrecognized ad hoc v1 fields are not reinterpreted as inventory.

Migration does not change Prestige, BW, personal perks, ownership, Favorite, notes, settings/overrides or character timestamps. Existing normalization may perform its already approved effects; structural conversion must be separately observable/testable. Do not invoke account normalization from new parse-only or normal-write entry points. No quantity is inferred from Owned, Prestige or artwork. Account/character setup markers keep their existing validation/default semantics.

Complete v2 supplied character records missing inventory are invalid. A queue-only v2 was approved on paper but is not implemented/released in current source; it is not a deployed predecessor needing a new version or silent migration. If implementation planning discovers a deployed queue-only v2 outside this inspected workspace, stop for an explicit compatibility decision rather than accepting incomplete v2 as empty inventory. No v2-to-v2 inference is approved here.

Carry explicit raw-input schema/migration signaling through parse/load. Compare-with-normalized-state alone cannot detect parse-time conversion. Read-only load shows complete v2 state/pending notice in memory without backup or write. Writable load backs up a valid predecessor before protected replacement using existing storage patterns. Preserve the predecessor's actual supported v1 state/version in the migration backup, rather than just calling the converted v2 copy a v1 backup. Invalid input never triggers replacement. Storage failure cannot adopt an attempted candidate. No second migration storage mechanism or automatic activity stamping.

Old v1-only builds continue to reject v2, preserving bytes and surfacing unsupported-version recovery. This is the already approved compatibility boundary, now protecting inventory as well as goals. No downgrade serializer. File and localhost origins remain separate; JSON portability remains essential.

## Import/export, backup, restore and reset

Extend the canonical validator before any quantity writes. `TrackerStorage.save/replace`, `exportSave` and all ordinary commits must retain both maps, unknown records and quantities. Validator reconstruction is the current data-loss risk; export alone cannot fix it.

Import replaces rather than merges. V1 import produces empty queue and inventory; confirmation explicitly warns that recorded goals/stock will be replaced with that empty state. Valid complete v2 import retains IDs/counts and queue order, with warnings for unresolved IDs. Supported positive state round-trips; explicit zero canonicalizes away. `exportedAt` remains existing export metadata. Read-only export may serialize normalized complete v2 memory without a write.

Existing snapshots include both maps and queue because they clone the canonical save; restore validates/migrates selected v1/v2 snapshots and backs up current state first. V1 restore empties goals/stock as deterministic replacement and warns accordingly. Reset backs up and returns fresh v2 state with empty queue, empty maps and existing defaults. Recovery preserves original stored bytes verbatim before replacement, as today. Do not create a backup on every quantity edit or edit-session keystroke; ordinary save behavior stays consistent with current normal edits.

## Shared quantity interaction

This section finalizes the previously recorded shared pattern in `01-survivor-items-addons-quantity-requirements.md`. All three inventory types use direct numeric entry, whole numbers >=0, optional +/- supplements, positive first and visible readable muted zero cards by default. Optional In Stock hides zero only for browsing; it is off by default.

Use `(stockGroup, catalogOrder)` for the displayed set, with deterministic canonical-ID tie-break only if catalog order is not unique. Never sort by count or display-name changes. Quantity crossing zero does not move/hide a focused editor. Typing holds the displayed snapshot; invalid text remains visible with an inline error, never coerced or saved. All quantity controls identify the entity. Catalog metadata lives outside the quantity map.

Detailed inventory pages use **individual autosave at valid Enter or blur**, labeled “Quantities save on Enter or leaving the field.” Enter accepts that numeric field, not the entire page; blur can commit, but cannot steal focus from the destination clicked/tabbed to. Invalid blur retains unsaved text/error without persistence or regrouping. A successful stable commit updates the current character once and may regroup/remove the affected card. Writer/storage failure keeps draft text, reports “Not saved,” and retains previous saved stock/order. Read-only controls are disabled while browse/filter/detail links remain usable.

Before regrouping capture the entity, active control/selection, intended next focus and old visible order. On Enter keep focus on the same entity/input if still visible. If In Stock removes it, focus the next surviving quantity input from the pre-commit sequence, then previous, then filter/section heading if empty. On blur respect a clicked/tabbed surviving destination instead of returning focus to the changed card; if that destination vanishes, use the same deterministic fallback. Announce saved quantity and removal/regrouping briefly through existing status conventions. Filter changes commit a valid active quantity first; invalid pending text keeps its card visible until corrected or explicitly discarded. Deliberate In Stock changes must not silently hide an invalid editor. No live sorting on input events.

Comprehensive Edit Character uses the approved session contract below, with a later durable commit than these single-field management surfaces. The same quantity parsing, catalog keys and grouping rules apply; no second inventory writer.

## Comprehensive Edit Character commit decision

**Human decision: APPROVED — explicit Save Character with one draft commit.** This deliberately supersedes individual autosave for the comprehensive character update task. Detailed Perks/quantity pages retain clearly labeled individual commits; initial setup retains its distinct existing semantics.

Final comprehensive task contract:

1. Enter `/edit` with a snapshot of current canonical state and one in-memory character draft. Show “Changes are not saved until Save Character.” Progression has Prestige and BW; personal perk controls provide search/scopes and I–III; Survivor stock has Items and Item Add-ons; Killer stock has only that Killer's Add-ons. Owned/Favorite/Notes are compact fields. Power is reference content, never an edit input. Preserve unknown records and setup flags in the draft.
2. Prestige, BW, personal tiers, quantities, Owned, Favorite and Notes all remain draft-only until Save Character. Draft Prestige previews derived account minima and perk eligibility, without changing account overrides or writing automatic tiers into personal records. Keep off-screen changes when filters/sections change. Re-evaluate personal-floor constraints at save against the final draft Prestige; explain any now-invalid selection and focus its control rather than silently raising/removing records. Historical acquisition controls retain current constraints and explicit correction remains separately labeled.
3. Numeric Enter/blur validates and accepts a field into the draft; it does not persist or submit the whole form. Keep quantity grouping/order based on the entry snapshot throughout the session. Defer zero/positive regrouping until successful Save Character. If In Stock would hide a pending changed/invalid row, pin it visibly as a pending edit until save/discard. Deliberate search/family changes may hide valid draft rows but retain their changes; invalid inputs must remain discoverable in an error summary and block save. Do not lose entered text during rerenders.
4. Save Character validates all fields and the complete candidate, checks live writer, and commits through the existing clone/validate/store/adopt boundary once. Apply only intended character fields to the current save; preserve account queue, unknown data, overrides and other characters. No automatic edit backup on each save. A no-op Save/Done returns without changing timestamps. Successful changed save stamps account and this character once with the same timestamp and forms one logical recent-character update, regardless of how many fields changed. Detailed single-record autosaves remain individual updates; neither workflow invents an event log.
5. Invalid save shows a short error summary plus per-field error linked/labeled for assistive technology; focus first invalid input, preserving all draft text and scroll context. A writer/storage/validation failure leaves saved bytes and in-memory canonical state unchanged and keeps the draft with an explicit Not saved notice for retry. On writer loss disable save/mutation but retain draft inspection; do not silently clear it. If a storage event/reload changes the underlying save during a dirty session, retain the draft and block committing stale state; require explicit discard/reload after explaining the conflict rather than overwriting newer data. No automatic merge or new synchronization service.
6. Successful save returns to the in-memory caller's valid workspace area, otherwise Overview. Refresh stock grouping only from committed state. Focus the return page heading/Edit Character entry with a saved announcement; if a future keep-editing interaction is added, it must use the same entity/fallback focus rules as detailed pages. Cancel with a clean draft returns immediately; dirty Cancel/back/workspace/global navigation offers Save / Discard / Stay. Invalid or failed Save keeps the task open. Discard restores saved state and never changes setup flags/timestamps. Browser hash back/forward must be intercepted/reconciled before clearing task state; do not reuse the unconditional existing hashchange discard behavior.
7. Reload/close uses a native unsaved-change warning where the browser supports it. Draft is memory-only and cannot survive browser termination; say this plainly and keep Save discoverable. No second persisted draft store. Explicit import/restore/reset/initial-setup or other mutation task cannot run over a dirty draft without the same save/discard/stay guard. Perk reference dialogs opened inside the edit session may browse but must not bypass draft writing through their existing immediate correction controls.

This cohesive task is preferable to per-keystroke autosave because it validates one post-play snapshot and gives Cancel an honest meaning. Retain initial Setup's existing immediate P1 and additive finish semantics, explicitly labeled; it is a distinct task, not an alternative Edit Character commit model.

## Implementation touchpoints and order dependencies

These are planning inputs, not an implementation plan or authorization:

| Existing touchpoint | Required responsibility |
| --- | --- |
| `src/model.js` | Complete v2 defaults/version dispatch, quantity canonical validation, unchanged perk/account selectors |
| `src/storage.js` | Raw migration signal, predecessor backup, complete canonical save/replace, failure/read-only retention |
| `data/catalog.js` and future verified inventory inputs | Frozen IDs, source identity mapping, order/role/compatibility, reference metadata; no duplicate save definitions |
| `src/assets.js`, asset/build inputs | Bind existing Survivor images through source IDs; verified Killer art/fallback; bundled catalog contract |
| `src/character-inventory.js` | Reuse candidate/record/tier helpers; share with draft-backed edit; canonical route descriptors/aliases |
| `src/app.js` | Shared workspace views/routes, popup producer replacement, edit/session handlers, focus/dirty guard, quantity commits, schema/import/recovery copy |
| `src/setup.js`, `src/character-setup.js` | Preserve account setup; move character/batch setup hosting from popup to task view without changing completion semantics |
| `src/editor.js` and app control/action gating | Gate every new mutation, leave browsing available; handle writer loss without silently discarding draft |
| `styles.css`, `index.html` | Existing shell/panels/nav, responsive cards/forms, labels/status/focus; no framework or dialog replacement |
| `README.md` | Later implementation updates portability/version information, no doc claim that current runtime is already v2 |

First agree/implement the complete v2 validator/storage boundary before quantities can persist. Verify catalog IDs/data before exposing stock controls; Killer add-on ingestion is required for those controls, while full structured Power mechanics can arrive later without changing routes/schema. Workspace routes/Overview and capability parity must exist before Dashboard/collection popup producers switch. Schema queue+inventory ships together; Dashboard presentation may be developed separately but cannot promise dead Overview links. Popup removal waits for setup/correction destinations. No released intermediate queue-only v2. The next task is a concrete implementation plan, not code in this pass.

## Future verification matrix

No implementation tests/builds were run for this documentation task. Later coverage uses existing Node/Playwright tooling and disposable storage/profiles, never destructive tests on the active account.

- Routing: all canonical routes, both roles, Edit/Setup, all old aliases, direct hashes/file/localhost, unknown/malformed/wrong-role sections, back/forward and equivalent alias sessions. Every approved Dashboard/collection identity action opens Overview without last-tab memory or popup.
- Capability parity: Owned/Favorite/notes/progression/native sources, setup offer/review, batch skipping/resume, P0/BW1 shortcut, immediate setup P1, special acquisition and historical corrections; account setup completion independent from character completion. No meaningful popup function disappears.
- Editing: Prestige >=0 safe integer, BW1–50 on every normal edit, personal I–III/clear, automatic floors, General availability vs personal ownership, historical missing/zero/no-downgrade and deliberate correction, both Survivor maps and Killer add-ons; no writes before Save Character, one successful multi-field commit/timestamp, no-op save, cancel/dirty navigation guards, validation/failure draft retention, storage conflicts and read-only gating.
- Quantity UX: exact typed values, +/- bounds, blank/fraction/negative/unsafe errors, positive-first and zero-visible defaults, stable catalog order, 0→positive and positive→0 held during edit, In Stock/other filters retain pending editors, Enter/blur/session-save regroup timing and predictable focus.
- Model/import: v1→complete v2 with unchanged existing data/timestamps, empty defaults for known/unknown records, no fabricated queue-reference records, strict missing/malformed v2 maps, unknown ID positive preservation, wrong-map/role/Killer ownership rejection, zero canonicalization, export/import semantic round trips, queue order/unknown/completed behavior unchanged.
- Storage/recovery: raw-version migration signaling, read-only no writes/backups, protected writable predecessor backup, canonical state retained on failed write/backup/import, full maps through every ordinary commit, backup/restore/reset and original-byte recovery. Legacy account normalization at existing entry points remains separate from structural conversion.
- Activity/queue: browsing/draft/validation/cancel are not recent updates; character commit updates intended timestamp(s); queue-only edits update account only. Corrected Prestige and Owned changes derive focus without dropping goals; Favorite is independent.
- Accessibility/responsive: real links/current section/headings, keyboard numeric/tier controls, status/errors and focus restoration, no nested interactions/color-only status, 44px targets, many-record sessions, 200% zoom and 320/500/760/1100/1440/1600 with long names/large values and no page-level horizontal overflow.

Extend relevant `tests/model.test.js`, `storage.test.js`, `recovery.test.js`, `editor.test.js`, `character-inventory.test.js`, `filter-domain.test.js`, assets/build tests and `tests/browser/character-inventory.mjs`, `data-flows.mjs`, `editor.mjs`, `recovery.mjs`, `portraits.mjs`, `smoke.mjs` where their actual responsibilities apply. Do not rerun these just to edit Markdown.

## Design readiness

Routes, workspace hierarchy, popup destinations, per-character inventory model, combined v2 contract and explicit Save Character commit model are resolved. **Ready for implementation planning; no remaining human product/compatibility approval decision was identified in this source audit.** Verified catalog/reference ingestion and runtime responsive verification remain implementation dependencies. If a deployed queue-only v2 is discovered outside this workspace, its compatibility requires a new decision as noted above. Stop after documentation reconciliation and review. No implementation planning or implementation starts in this task.
