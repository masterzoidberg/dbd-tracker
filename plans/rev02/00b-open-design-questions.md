# Rev02 Open Design Questions

## Status

**For design review · 2026-10-21 · Recommendations are not approvals.** These questions materially affect the redesign or future behavior. Resolve them at the appropriate global or screen review, before dependent implementation. They do not block completing this audit.

The confirmed brief is desktop primary, with balanced browsing/planning and editing; editing should be denser and optimize repeated input. Mobile stays fully usable. That density principle is settled and is not reopened below. The approved Dashboard hierarchy and separate Survivor/Killer Up Next lists are also settled.

## Global Direction Decisions

| ID / question | Why it matters | Options | Current recommendation / decision point |
| --- | --- | --- | --- |
| G01 — Which identity direction should proceed to screen exploration? | Determines type/surface/art treatment without changing product purpose | Trials Archive; Bloodweb Terminal; Trial Preparation Bench; the proposed Archive identity with Terminal editing precision | Recommend the hybrid described in `00-ui-ux-redesign-strategy.md`. Approve the concept before developing detailed visual screen designs; exact tokens remain open. |
| G02 — How should dense editing appear? | More controls per viewport must retain item recognition and readable values | Compact rows; compact art-plus-value tiles; adjustable existing-style visual sizes | Compare rows and compact tiles with real stock/tier content in the inventory screen reviews. Favor one good default per task before introducing another persistent density setting. |
| G03 — Which context and action remain visible during editing? | Large repeated character headers and strong Edit Character compete with quantities; Save sits far away | Full shared header everywhere; compact operating header retaining identity/role/section; optional sticky task controls | Recommend a compact editing treatment using the same header grammar, with Save/draft feedback reachable when relevant. Validate sticky regions against keyboard focus and viewport height. Existing Dashboard approval leaves shell actions unchanged until this shared decision is explicitly reviewed. |
| G04 — What content-width policy serves the tasks? | A wider global cap alone does not solve inefficient grouping; prose and numeric comparison need different measures | One global fixed cap; fluid work area; shared outer canvas with bounded prose and task-specific inner layout | Recommend a shared outer canvas with width determined by useful columns, and narrower reference prose. Compare at 1366/1440/1920 and later ultrawide; do not choose a pixel cap from taste alone. |
| G05 — How far should the archive concept affect typography and atmosphere? | Condensed labels/texture could add identity or harm long-session reading | System sans only; one restrained heading face; additional atmospheric texture | Start with a readable system/workhorse sans, tabular figures, and no texture in editing. If needed, compare one compact heading role and peripheral static texture in browsing. No proprietary font/import commitment. |
| G06 — How should role identity read apart? | Must remain obvious without becoming two unrelated applications or colliding with rarity colors | Role text/art alone; restrained non-color marker; subtle additional accent | Recommend role text plus portraits and family/Power structure first. Only add a marker if screen comparisons show a genuine orientation benefit. |
| G07 — What mobile navigation and working context best supports the existing six global destinations? | The current scroll strip hides later destinations and the product name; tablet sidebar reduces working width | Revised labeled menu; reorganized top navigation; retained strip with improved discovery; bottom destinations plus overflow | Recommend a labeled compact navigation pattern that preserves all destinations, without assuming a five-item bottom bar. Choose in shared/global review after screen priorities are known. |

Cards are permitted where they explain peer objects or editing boundaries; “box everything” is not a proposed option. Final placement, border/radius/contrast tokens and typography scale belong in later shared consolidation. Avoid asking for arbitrary CSS values now.

## Workflow Questions for Screen Reviews

| ID / question | Why it matters | Current recommendation |
| --- | --- | --- |
| W01 — During stock reconciliation, does the user primarily match icon, name, rarity sequence or the game's inventory position? | Determines compact tile/row order, artwork size and whether a density change actually speeds comparison | Preserve names and recognizable icons; compare alternatives on real quantities before locking geometry. Do not copy the game's menu solely to match its grid. |
| W02 — Should simple Prestige/Bloodweb updates have a focused edit path or a shortened composite form? | Current Save is separated from these fields by perks and stock | Recommend a focused progression task with explicit save safety, or a reachable commit area within the existing edit flow. Workspace review must choose the behavior; no quick editor is approved yet. |
| W03 — Should previous/next follow the whole catalog or the invoking filtered roster? | Current links preserve section but disregard owned/search/Favorites subset | Preserve predictable canonical ordering by default; consider retaining a scoped traversal only if the user's repeated workflow needs it. Define entry/deep-link behavior explicitly. |
| W04 — Should family/search context persist when moving between Survivors? | Each new stock session currently resets family and search, even though character links preserve the stock section | Recommend retaining the active family for a repeated reconciliation session if the screen review confirms this is useful. Search, item compatibility and invalid-input handling need explicit rules. |
| W05 — Which ownership/tier fact should lead in rosters, normal Perks and reconciliation? | Current effective native tiers can look like explicit recorded ownership on unowned characters | Recommend effective tier for “what is usable,” explicit recorded tier for reconciliation, and provenance on demand. Confirm terminology with the user; never change calculation rules to fit a simpler label. |
| W06 — Does the Killer's fixed 20-Add-on list need search or In Stock parity with Survivor stock? | Same control language does not imply the same discovery complexity | Decide based on lookup/reconciliation needs; do not add filters solely for symmetry. |
| W07 — Is correction by re-entry sufficient for immediate stock/tier edits, or is lightweight undo needed? | Autosave has no obvious immediate undo; backups are unrelated | First validate error frequency and correction cost. Prefer immediate clear feedback; a new undo model requires explicit scope and persistence decisions. Do not add confirmation to every increment. |
| W08 — Where should setup, catalog detail and displaced analytics live? | Data & backups mixes these with the portable-data task; Dashboard already de-emphasizes/removes secondary content | Review their deeper destinations during roster/perk/Data plans. Do not create a Statistics page or separate Settings route without a concrete approved need. |

## Dashboard Questions Carried Forward

These are the five existing questions in `01-dashboard.md`, grouped for future queue/resume design. Their presence here does not reopen approved caps, role separation, manual ranking or the three Dashboard jobs.

| ID / question | Why it matters | Current recommendation for review |
| --- | --- | --- |
| D01 — Can a character have both Prestige and Playing intent, and how is it counted? | Duplicate rows versus a unique-character cap changes Up Next clarity | Permit both deeper intents; favor one pinned row per character with an explicit primary intent and optional secondary indication. This is only a proposal pending queue review. |
| D02 — Can users pin directly, or must they first add to a deeper queue? | A mandatory queue detour may make an immediate priority unnecessarily costly | Favor direct pinning that explicitly asks for intent and defines any queue membership it creates. Never infer intent from Favorites or recommendations. |
| D03 — What happens when all five spots for a role are full? | Silent eviction would violate user ranking and intent | Offer an explicit replace/unpin choice showing existing ranked entries; no automatic eviction or new ordering. Exact flow awaits review. |
| D04 — Which routes should Continue resume? | Temporary Edit/Setup/Update routes may depend on unsaved or session-only state | Favor stable Overview, Perks, Items & Add-ons, Power & Add-ons; temporary flows return to their stable parent unless durable restoration is separately approved. |
| D05 — Does last location travel with the save? | Browser navigation preference and account progression have different portability/migration needs | Favor browser-local navigation state independent of progression timestamps, validated against existing canonical routes. Confirm expected cross-device/export behavior before implementation design. |

## Survivor Workspace Decisions for Review

Added 2026-10-22 from [03-survivor-workspace.md](03-survivor-workspace.md). These are detailed recommendations, not approved behavior changes. The three workspace tabs, contextual editing homes, direct quantity steps and family → Item → compatible Add-ons hierarchy are settled user direction and are not reopened here.

| ID / question | Why it matters | Recommendation / approval needed |
| --- | --- | --- |
| SW01 — Keep per-selection autosave in Perks Update, or introduce a staged Perks-only Save/Cancel transaction? | Current Update saves each tier immediately; the monolithic editor instead supports a draft. Cancel cannot honestly undo immediate writes. Historical and account-wide controls must follow clearly stated boundaries. | Recommend explicit entry into Update mode with current per-selection autosave, Done to exit, accurate saved feedback and retry on failure. A staged alternative needs real draft previews, conflict/dirty protection and unified save wording; approve that change explicitly if wanted. |
| SW02 — What guard should deliberate personal-tier correction use? | The old editor has a separate correction path that can lower/clear historical records or records below derived floors; ordinary acquisition controls cannot replace that capability. | Recommend a labeled correction disclosure in Perks with before/result explanation, distinct from ordinary tier selection. Confirm whether lowering/clearing also needs a separate confirmation; automatic effective minimums remain unchanged either way. |
| SW03 — Are per-task atomic saves sufficient when retiring the composite editor? | Save Character currently commits progression, metadata, perks and stock together; distributing editing removes the single cross-task transaction even if each replacement is safe. | Recommend atomic progression-pair saves, explicit note saves and existing direct operational saves. Confirm whether any actual workflow requires cross-task cancellation/atomicity before retiring the old behavior; do not recreate a fourth workspace speculatively. |
| SW04 — Which working context should survive next/previous Survivor? | Section/mode already survives, but current perk update state resets on route change and stock resets to the first family. Retaining context speeds repeated work but can also hide results unexpectedly. | Recommend session-local search/category/family/filter and valid selected-Item retention, visible active restrictions, reset access, and separate per-character change counts. Clear stale selected perks; never transfer draft fields or quantities. Confirm which controls, if any, should reset. |

Existing W02 has a concrete progression-editor recommendation in plan 03; W04 is refined by SW04; W03 catalog-versus-filtered neighbors remains open, with catalog neighbors recommended. W05 now has a concrete workspace recommendation: effective personal tier leads, with explicit record and account access separately labeled. **General availability can be true at global tier zero**, so the roster's pending account-access proposal needs that qualification before approval. None of these recommendations changes the approved Dashboard design or silently resolves an existing open question.

## Killer Roster Artwork Policy for Review

Added 2026-10-22 from [04-killer-roster.md](04-killer-roster.md). **Lore-first Killer character-identity imagery and six-per-page roster presentation are settled user direction**, not questions. The local audit found 43 valid Lore portraits for 44 Killers; the current roster already uses this set, while workspace identity uses a separate square set. No production asset change is authorized.

| ID / question | Why it matters | Recommendation / approval needed |
| --- | --- | --- |
| KR01 — When genuine Lore art is absent, allow an explicitly mapped temporary older portrait or retain neutral fallback? | The Slasher has no file in the intended Lore directory, but has a valid separate 512×512 workspace portrait. Choosing an exception changes the source-consistency policy; it is different from simply fixing a bad filename. | Recommend neutral named fallback by default until genuine Lore art is available. If a temporary square-portrait exception is preferred, approve it explicitly for the missing-source case; available Lore assets still take precedence. Do not copy/rename the old image into Lore and count it as authentic coverage. |

The missing Slasher file, seven missing Power icons, five REVIEW-qualified Power mappings and per-image fit/resolution exceptions are routine asset/validation dependencies, not separate user-design questions. Power names cover all 44 and can support a consistent text baseline. No character-alias search source was established; that feature remains deferred. Existing W05 and G04/G07 continue to govern shared roster semantics and shell width; they are not duplicated here.

## Review Sequence and Recording Decisions

Review the high-level identity recommendation first, then continue the existing screen order. Resolve workflow questions when their screen is examined. Keep agreed product facts separate from visual proposals, and update the relevant document with the user's decision and its implications.

No need to answer every question at once. G01 is the next useful high-level decision; W01/W02/W05 are the most consequential workflow questions for early screen reviews. Shared token values, final palette/font specimens and motion timings should follow actual screen comparisons rather than becoming premature global constraints.

After all major screen plans are reviewed, consolidate shared/global findings and review the resulting design system. Only then create the dependency-aware implementation roadmap. No roadmap is included in this packet.
