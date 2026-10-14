# Dashboard design options

Date: 2026-10-13. Status: options comparison retained as historical rationale; **Option B approved by the human on 2026-10-13** through review of `03-dashboard-rework-design.md`. Not an implementation plan. Subsequent Character Workspace design finalizes the navigation dependency at `#character/<id>/overview` and combines queue and quantities in complete v2; see `../character-update-rework/04-routing-and-compatibility.md` and `05-inventory-and-editing-design.md`. Earlier risk comparisons below describe discovery-time implementation dependencies, not open product questions.

## Shared decisions and evaluation basis

All options retain the static application, canonical IDs, local persistence, writer protection and backup workflow. Human decisions establish one global manually ordered queue; arbitrary positive safe-integer targets greater than current Prestige when assigned; P1/P3/P6/P9 shortcuts; derived completion; completed/unowned/unknown entries preserved; owned-only additions; Current Focus is first unfinished owned available entry; all Dashboard character actions open future Overview; schema v2 with v1 migration; unchanged legacy account normalization.

All queue options therefore have the same schema impact. Reordering existing cards alone would need no schema change, but would not meet the personal-plan objective. No usage analytics or live-account observation was available; usefulness assessments follow the stated workflow and actual code capabilities.

## Option A — Refined existing Dashboard

### Information hierarchy and wireframe

```text
Account overview                         quiet catalog link
Survivors / Killers                       compact current summaries
My Prestige Queue                        highlighted Current Focus row
Suggested P1 targets
Survivor perks / Killer perks
Continue where you left off
Prestige distribution
Favorite shortcuts                       optional compact disclosure
```

### Queue behavior

Add a compact queue panel below ownership cards. Highlight the eligible focus row in place. Show a small global-order preview and a Manage queue control. In-place management expands the full ordered list, target editing, add/remove and Move Up/Down controls. No separate pin or drag-and-drop in V1.

### Recommendation behavior

Preserve the five-candidate algorithm and separate Suggested P1 targets section. Mark existing queue membership; offer Add to queue for candidates not already queued. No automatic sorting of manual goals.

### Recently updated behavior

Rename to “Continue where you left off,” explain that it means recent edits, retain five entries with Overview links. Move above distribution, but keep behind most account summaries.

### Data/state requirements and migration impact

One persisted `prestigeQueue` array in schema v2; v1 initializes empty after existing normalization. Completion/focus/role/benefit are derived. Filters and management disclosure are ephemeral. Full backup/import/export validation work remains necessary despite the modest layout change.

### Accessibility and responsive behavior

Reuse native controls, visible focus, text metrics and portrait fallbacks. List-based queue with stable control IDs and reorder announcements. Role cards stack at existing narrow breakpoint; queue rows wrap with actions on a second line. No order-changing interactions in filtered views.

### Benefits

- Least disruption to the familiar collection-first opening.
- Reuses nearly all current panel composition.
- Adds an explicit plan without a radical visual shift.

### Drawbacks

- Still answers account state before personal work.
- Queue can remain below the initial mobile viewport.
- Persistence complexity is almost the same as Option B, for a weaker workflow improvement.

### Implementation risk

Low visual risk, moderate persistence risk. Overview navigation is still a dependency. Limited restructuring does not remove the need to test migration and reordered list focus.

## Option B — Action-first Dashboard, with focus integrated into the queue

### Information hierarchy and wireframe

```text
Account overview                         Catalog 10.1.2a -> details
Conditional account setup prompt         only while incomplete

My Prestige Queue                  | Continue where you left off
  Current Focus                    |   recent edited character links
  global-order preview             |   Prestige / Bloodweb / timestamp
  Manage queue                     |

Suggested P1 targets                      up to five compact rows
Survivors / Killers                       ownership, P1+, P3+, locked
Survivor perks / Killer perks             available / total, locked, III
Prestige distribution                     quiet owned-only bars
Favorite shortcuts                        compact, secondary
```

On narrow screens use the exact reading order above: queue, resume, suggestions, collection, perks, distribution, Favorites. This differs from the task's sample by moving resume work higher and avoiding a separate full focus card that repeats the queue.

### Queue behavior

Current Focus is a prominent subregion of the queue panel, not a second independently maintained section. A compact preview exposes the first three global positions and also the focus position if it lies outside that preview. The focused character's detailed content appears once; the preview can identify its position without repeating the full card. Completed/unavailable entries remain visible in global order with text status. Manage queue expands the same panel. No background archive or completed-entry cleanup.

One goal per character. New entries append to the global array. All/Survivors/Killers can filter the management list, but focus always uses the whole queue. Reordering is enabled only in All, preventing ambiguous jumps across hidden entries. Global position numbers remain unchanged in filtered views.

### Recommendation behavior

Keep the existing five suggestions in a compact distinct section. Explain missing-perk primary ranking and Bloodweb tie-breaking. Existing queue entries receive an “In queue” label, preserving recommendation transparency even for queued characters. Add opens target selection with P1 preselected where valid; it does not mutate until confirmed. A zero-benefit recommendation does not appear. Manual queue targets above P3 remain valid personal goals.

### Recently updated behavior

Give resume work comparable early visibility. Use five recent edits, actual parsed chronological ordering, current Prestige/Bloodweb, and an absolute or safely derived relative timestamp. Keep unowned edited characters visible with “Not owned”; known characters can still open Overview. This is not visit tracking or last-tab restoration.

### Data/state requirements and migration impact

Same minimal queue schema as A. No history, notes, stored rank, role, focus or completion flag. Schema migration signal must survive parsing and writer-gated persistence. Queue-only edits update account timestamp but do not manufacture character activity.

### Accessibility and responsive behavior

DOM order follows task priority. A desktop queue/resume pair stacks below the existing 1100px breakpoint; summaries stack at <=760px. Queue management is an ordered list with independent links and buttons, not nested clickable rows. Move Up/Down is the primary mechanism; announce global positions, preserve focus, and disable boundary moves. Text communicates completion/availability; progress uses accessible counts. Long names/large targets wrap.

### Benefits

- Best answers both “what next?” and “where did I leave off?”
- Adds one explicit personal plan while keeping a useful independent suggestion engine.
- Retains collection metrics without making them the first decision.
- Supports higher Prestige goals without inventing a new unlock model.
- Avoids duplicate Current Focus and full queue panels.

### Drawbacks

- Greater layout change than A; requires thoughtful empty-queue behavior.
- A long queue needs disclosure/preview discipline.
- Focus can change when imported/corrected Prestige or ownership changes; that behavior must be explained without silently changing order.

### Implementation risk

Moderate overall: small presentation functions and no dependencies, but meaningful data validation/migration and keyboard focus work. Navigation cannot ship as promised until Overview exists. Current CSS and text helpers reduce visual risk, while source-only discovery leaves final responsive appearance unverified.

## Option C — Collection Dashboard with subtle goals

### Information hierarchy and wireframe

```text
Account overview / catalog
Survivors / Killers                       statistics dominant
Survivor perks / Killer perks
Prestige distribution
Next goals                               compact queue + suggested targets
Continue where you left off
Favorites
```

### Queue behavior

Small queue card near the current targets panel; highlight first eligible entry and expand for management. Same global manual ordering/completion rules. It must retain a clear distinction between chosen goals and algorithmic suggestions even if they share a panel area.

### Recommendation behavior

Preserve the current P1 ranking in an adjacent subregion. Do not merge algorithmic candidates into user-authored order. Candidate badges and explicit add controls remain possible.

### Recently updated behavior

Keep near the bottom, improve wording and Overview links without changing its main position.

### Data/state requirements and migration impact

Identical queue and v2 compatibility requirements. A smaller queue card does not justify a weaker persistence contract.

### Accessibility and responsive behavior

Retain current summary layout, add accessible ordered-list management and text statuses. On mobile the queue follows multiple summary panels and charts, making the next task expensive to reach.

### Benefits

- Strongest familiar collection overview and easiest comparison of roles.
- Lowest conceptual disruption for users opening primarily to check statistics.

### Drawbacks

- Least aligned with the explicitly requested progression home screen.
- Personal goals remain visually subordinate.
- Highest passive visual density if all current metrics stay prominent.
- No evidence of account-checking usage sufficient to outweigh the stated action-first intent.

### Implementation risk

Low presentation risk, moderate persistence risk. Preserving passive hierarchy reduces UI change but fails to exploit the queue's principal value.

## Comparison

| Criterion | A: refined existing | B: action-first | C: collection |
| --- | --- | --- | --- |
| Next-work usefulness | Moderate | High | Low |
| Resume usefulness | Moderate | High | Low |
| Visual density | Moderate | Controlled through preview/details | High |
| Layout complexity | Low | Moderate | Low |
| Schema impact | Small v2 extension | Same | Same |
| Navigation | Future Overview required | Same | Same |
| Narrow-screen task access | Queue below summaries | Queue first | Queue late |
| Future compatibility | Adequate | Strong goal-based composition | Risks catalog-summary expansion |
| Overall implementation risk | Moderate | Moderate | Moderate |

## Recommendation

Choose **Option B with integrated Current Focus and early resume work**. Its value follows the product's stated intent rather than an assumed usage pattern: manual goals solve an actual gap in the current code, while source-derived suggestions and recent edits already provide useful complementary actions. A and C incur nearly the same persistence work while leaving personal priorities less discoverable.

Keep collection access, P1/P3 counts, perk access, distribution and provenance. Quiet total/average Prestige through an optional summary details disclosure rather than deleting data or creating a new Statistics page. Keep Favorite shortcuts secondary. Do not add inventory totals or reserve empty Dashboard regions for future Items/Add-ons.

The human approved Option B and the complete `03-dashboard-rework-design.md` on 2026-10-13. The Dashboard review gate is satisfied. Character Workspace architecture and Overview route are now finalized by its separate design; implement that destination before switching Dashboard producers. This documentation update requests no implementation or implementation plan.
