# Shared inventory quantity interaction requirements

Date: 2026-10-13. Source: explicit human product requirement supplied during Dashboard discovery, subsequently extended to Killer Add-ons on 2026-10-13. The original Survivor-specific filename is retained for existing references.

Status: **approved shared quantity interaction; no implementation authorization**. This planning directory was absent before this record. The subsequent Character Workspace design in documents 02–05 now defines workspace structure, routes, commit behavior and the proposed complete-v2 inventory model. This requirements record remains the original interaction reference; it does not itself approve a catalog or implementation plan.

## Goal and scope

Optimize future inventory for quickly recording exact current quantities, rather than primarily browsing descriptions. The approved default shared quantity interaction applies to Survivor Items, Survivor Item Add-ons and Killer Add-ons. This explicitly supersedes the initial Survivor-only interaction scope. This interaction record alone does not approve the complete Killer inventory architecture, catalog, state model or workspace structure; the subsequent documents 02–05 address that separate design.

## Direct quantity entry

- Each item/add-on entry provides a numeric quantity input.
- Clicking the displayed current count lets the user type the exact number directly.
- Optional minus/plus buttons support one-step adjustments; they supplement direct entry.
- Accept whole numbers >=0 only. Never allow negative quantities.
- Inputs need accessible labels naming the entity. If adjustment buttons are supplied, their labels identify the entity and minus cannot decrement below zero.

## Zero-count presentation

- Quantity zero means currently not owned.
- Zero-count entities remain visible by default so the complete catalog can be updated quickly.
- Visually mute/gray zero stock while retaining readable labels, usable inputs and visible keyboard focus.
- Present positive-stock entries before zero-stock entries, resembling DBD's inventory prominence.
- An optional Owned only filter may hide zero stock. Default viewing must not do so.
- Communicate zero/not-owned through quantity/text as well as color.

## Stable sorting and editing

Two groups: quantity >0 first, quantity =0 second. Within each group retain stable canonical catalog order; do not sort by quantity or repeatedly reshuffle entries while typing.

A change such as 0 ->5 must not move the card while its quantity field is actively being edited. Apply re-grouping/re-sorting after an explicit stable commit point: valid Enter/blur on detailed inventory pages, or successful Save Character in the comprehensive edit session. The finalized contract in 05 defines validation/focus behavior. Unsaved comprehensive draft values must not trigger regrouping.

The same principle applies when stock crosses from positive to zero. If Owned only is active, defer removal from the visible list until commit rather than making an active field disappear mid-edit. Commit should preserve a predictable keyboard continuation point when a card moves or leaves the filter. Exact detailed-page versus comprehensive-edit commit rules are authoritative in `05-inventory-and-editing-design.md`.

## Save-model guidance

Prefer sparse positive quantities where compatible with the future persistence architecture. Missing canonical ID may mean zero; committing zero can omit its record. Store canonical IDs and quantities only, not name, rarity, effect, descriptions or image paths.

Illustrative shape, not approved IDs or schema:

```json
{
  "items": {
    "flashlight/utility-flashlight": 4,
    "med-kit/emergency-med-kit": 7
  },
  "addons": {
    "flashlight/battery": 12,
    "toolbox/brand-new-part": 2
  }
}
```

Current `src/model.js` has no Survivor item quantity model; `src/character-inventory.js` concerns perk inventory. The example's slash-separated IDs differ from current save ID validation, so future inventory design must choose/validate its real canonical namespace explicitly. Do not implement or broaden `safeId` based on this illustration alone.

## Future design acceptance checks

- Exact typed counts and optional increments/decrements respect integer >=0 validation.
- Zero stock remains visible/muted by default; Owned only is optional.
- Positive-first grouping preserves canonical order within each group.
- Editing 0 ->5 or positive ->0 does not move/hide the active card before commit.
- Commit behavior, error handling and keyboard focus remain predictable when re-grouping/filtering.
- Catalog metadata remains separate from per-character quantity state.
- Killer Add-ons use the same approved default quantity interaction; the subsequent workspace design documents their inventory architecture and data dependencies separately from this original interaction record.

## Relationship to Dashboard design

Referenced by `../frontpage-character-update-rework/03-dashboard-rework-design.md`. No Dashboard inventory panel or inventory-count metric is implied. Character Workspace decisions are now documented in 02–05; verified catalogs remain an implementation dependency. The illustrative slash IDs above remain source examples, not approved persisted IDs; 05 defines hyphenated save namespaces without broadening `safeId`.
