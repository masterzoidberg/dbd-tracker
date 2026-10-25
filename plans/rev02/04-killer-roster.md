# Rev02 Killer Roster Design

## Status

**Design-direction plan and read-only asset audit · Planning only · Not implemented · 2026-10-22.** Covers the Killer roster and character-identity artwork policy. It does not design the full Killer workspace or change production mappings, images, code or CSS.

Read with the [global strategy](00-ui-ux-redesign-strategy.md), [audit matrix](00a-ux-audit-matrix.md), [questions register](00b-open-design-questions.md), approved [Dashboard direction](01-dashboard.md), [Survivor roster](02-survivor-roster.md) and [Survivor workspace](03-survivor-workspace.md). Earlier documents' detailed recommendations remain recommendations unless explicitly approved. The user's current brief settles six-item Killer paging and Lore-first Killer identity imagery; it does not approve every detail proposed below.

**Important audit correction:** the checked-in roster already uses Killer Lore portraits for 43 of 44 Killers. The separate workspace portrait helper uses the older square set. Rev02 therefore needs a consistent identity-source policy and later workspace adoption, rather than a presumed wholesale roster swap from old artwork. Source/deployment equivalence has not been established; these are repository findings, not a claim that every currently published page has the same bundle.

## Screen Purpose

**Find and recognize a Killer, understand progression and native-perk account value, remember their defining Power, and open their workspace.**

The roster is a browsing and navigation surface. Detailed Power reference, personal perk records and Add-on management belong in the Killer workspace. No analytics, meta ratings or build advice is needed to answer its primary questions.

## Primary User Jobs

1. Recognize a Killer from Lore artwork and their canonical name.
2. Find one through search, existing scopes and sort.
3. Scan Prestige and current Bloodweb level.
4. Recall the Killer's Power by name, with an optional reliable icon.
5. See the three native perks and clearly scoped account access.
6. Open Overview through most of the card, or independently change Favorite.

## Current Screen Assessment

### What Works

- `#killers` uses the same `collection(role)` and `characterCollectionCard` logic as Survivors. Familiar discovery and progression concepts already share an implementation.
- Explicit manifest mappings already resolve 43 role-correct Lore PNGs. Stable canonical IDs keep filename aliases separate from save records.
- Search, ownership/Prestige/Favorite filters, sort, optional paging, Favorite pressed state and canonical workspace links exist.
- Every Killer has a Power record/name available through `killerPowerByCharacterId`; no new gameplay dataset is needed for the proposed Power line.

### Current UX Friction

- The default is All, with 5/10/All choices. All 44 tall cards compete instead of presenting six readable records.
- Ownership editing, three perk-dialog buttons, multiple links and summaries compete with navigation. The helper says name/Prestige edits a character, although both open Overview.
- Native tiers labeled OWNED are effective personal tiers, not account unlocks or necessarily explicit recorded copies.
- Power is absent from the roster despite reliable names deeper in the workspace. The Add-on type count occupies space without explaining the Killer's defining mechanic.
- The Slasher's missing Lore mapping yields a blank hero without an explicit unavailable-art explanation, despite a valid square workspace portrait.

### Current Visual Friction

- Auto-fill columns at a 250px minimum prioritize simultaneous quantity. The final collection CSS uses 16px gaps and a 190px image region with text beginning at 112px.
- Art is overlaid/faded and additionally muted for unowned characters. Lore sources already contain transparency/fades; more dimming reduces recognition.
- Names, progression, native-perk microtext, inventory totals and the footer compete. Larger cards should remove that competition, not accumulate more metrics.
- The owned count is detached at the far right of the header. Controls/results/paging use several bands; paging currently appears before the grid.

## Approved Shared Roster Direction

- **Six Killers per page**, independent of responsive column count.
- Desktop/suitable laptop: **3 columns × 2 rows**; tablet **2 × 3** when usable width supports it; phone **1 × 6**.
- Larger useful artwork and readable card facts; stronger Prestige/Bloodweb hierarchy.
- Lore is the intended Killer **character-identity** source for the roster, future workspace header and other appropriate character surfaces.
- Shared search/filter/sort, header/count, Favorite, ownership, navigation and accessibility grammar with Survivors.
- Broad card navigation and a visible View Killer cue; independent controls must not accidentally navigate.
- Deliberate pagination below the roster. No All default or proliferation of analytics panels.

These are settled directions from the brief. The exact card composition, native access scope, optional icon and ownership interaction below are recommendations for review.

## Killer-Specific Information Hierarchy

1. **Lore artwork and Killer name** establish recognition.
2. Quiet **Owned / Not owned** and secondary **Favorite** remain near identity.
3. **Prestige + Bloodweb** form one unmistakable progression group.
4. **Power name** supplies the defining gameplay identity, with a small optional icon.
5. **Three native perks** supply account-progression context.
6. **View Killer →** makes the card's primary destination discoverable.

Ownership/Favorite placement does not make them the card's loudest elements. Power receives a concise identity line rather than a separate framed widget or description. Survivor and Killer cards share operational behavior, while this Power identity gives the Killer card a functional difference.

## Killer Card Design

### Killer Lore Artwork

Give the Lore art a dedicated region above text. For typical desktop cards around 345–425px wide, explore approximately 220–250px of useful art height; on phones begin around 180–210px. These are visual-review candidates, not fixed tokens or a demand that both rows fit every viewport.

Separate names from unstable image backgrounds. Use a restrained dark surface and the art's transparency rather than a new gradient/scrim system. Avoid automatically multiplying source transparency with strong unowned dimming. A name and explicit ownership label remain readable regardless of art.

Contain is the safest initial fit for masks, weapons, paired figures and variable aspect ratios. Apparent head/body scale needs actual per-image review; a bigger empty slot alone does not produce recognition. Preserve important features while keeping visual alignment coherent; see the crop strategy and measured exceptions below.

### Killer Identity

Use the canonical name, including its article/diacritics, as a readable card heading. Allow natural wrapping, for example The Skull Merchant and The Onryō. Explore the same roughly 18–20px name role as the Survivor proposal, not marketing-scale type or tiny metadata. Do not replace display names with filenames or franchise aliases.

### Ownership

Keep understated Owned / Not owned text, with a non-color distinction where useful. Unowned characters remain readable and their workspaces accessible. Never infer ownership from portrait availability or erase existing records when unowned.

Recommend status rather than a full-width roster ownership switch, matching the Survivor proposal. Ownership management can remain in the current character workflow until the Killer workspace receives its own approved plan. This recommendation does not approve a workspace redesign or remove today's capability.

### Favorite

Keep a secondary independent star button with the existing approximately 44px target, character-specific accessible name and pressed state. Outline/filled state and text naming supplement color; hover/focus tooltip can explain it. Favorite does not imply Prestige/Playing intent or an Up Next pin.

Preserve writer protection, saved/error feedback and focus after rerender. Favorites filtering can remove the edited card, and Recently updated sorting can move it because Favorite commits update the character timestamp. Focus should move predictably to the next remaining result or results heading when the original control disappears. Never show an unsaved toggle as successfully stored.

### Prestige

Use the shared Pn grammar and a strong numeric anchor, supporting P0, P1, P3, P100 and other valid stored values. The model permits non-negative safe integers rather than an imposed P100 cap. Give assistive technology the expanded “Prestige n” meaning. Prestige does not need a second link/tab stop to the same workspace or a misleading direct-edit cue.

### Bloodweb

Place Bloodweb n / 50 beside Prestige, with grouped wrapping on narrow cards. This is the recorded current level, validated 1–50. An optional thin track can reinforce it, but not imply linear XP, resource cost or completion to P100. Adjacent numbers carry the exact fact; a redundant track can remain decorative/hidden from assistive technology.

### Killer Power

**Recommend a required Power-name line**, for example **Power · Evil Within**, below progression and above the native trio. `killerPowerByCharacterId[id].powerName` covers all 44. Use the canonical supplied name rather than derive it from image filenames or summaries.

An approximately 28–36px icon can assist recognition when an accepted mapping exists. Text must work equally well without it; missing icons must not leave a dominant empty frame or make seven cards look incomplete. All 37 mapped icons decode, but five carry REVIEW rather than EXACT confidence. File integrity does not approve those semantic mappings; retain their qualification for later asset review.

No Power description, mechanical stats, Details button or second navigation target is needed on the roster. The workspace supplies rich reference. Lore portraits never substitute for missing Power icons. The name is the baseline, so icon completeness does not block this layout.

### Native Perks

Keep three readable names in a consistent compact block; no perk descriptions, extra icon strip, many chips or tiny columns. Recommend account-progression scope, consistent with the Survivor roster's pending recommendation: **Native perks · Account access**.

For each native perk, show a clearly scoped state from availability and global tier: unlocked Tier I/II/III, General availability without a guaranteed global tier, or not unlocked. Use `isAvailable` as well as `globalTier`: The Shape/Cenobite definitions include General availability and can be available at global tier zero. Do not reproduce effective native Tier I as proof of global unlock or personal acquisition.

Prestige derives global tiers up to III; Shrine/Legacy/manual overrides can already grant access. Do not say “level this Killer to unlock all three” when current access is already present. Account facts and source naming must follow existing canonical aliases/display preferences; no rule changes or data rewrites. Brief shared scope explanation can avoid repeating a paragraph per card.

Recommend informational native rows, with detailed personal records/provenance and perk dialogs reachable in the workspace. This leaves one primary card destination. The global W05 terminology and Survivor roster scope choice are still pending; approval should keep both roster roles semantically consistent without collapsing the workspace's richer personal/recorded/account presentation.

### Workspace Navigation

Use one real anchor named by the Killer and **View Killer**, targeting canonical `#character/<id>/overview`. Extend its pointer target over artwork and non-control card space; Favorite is a sibling button, never nested in the anchor. The visible cue belongs to the same link rather than creating repeated identical tab stops.

Keep real link behavior: Enter, new tab, context menu and browser Back. Do not implement the article as a button/click-only div, wrap interactive controls in a link, or let Favorite bubbling navigate. Logical focus order per card is link then Favorite; show distinct visible focus. No edit, Power-dialog or perk-dialog action is implied by the navigation surface. Touch and keyboard users receive the same essential content without hover.

## Lore Portrait Strategy

### Source Directory

**Intended Killer character-identity source:**

`G:\Projects\dbd-tracker\images\updated-images\Character Portraits\Killers\Lore`

Apply this preference to roster cards, the future Killer workspace character header and appropriate character-identity surfaces. This establishes asset-source direction only for the workspace; its layout/editing remains unreviewed. Do not change Survivor imagery or use Lore art for Power, perk, Add-on or unrelated detail images.

### Canonical Mapping Strategy

Recommend an explicit **canonical character ID → manifest asset entry** contract, retaining the existing manifest's path, source path, format, dimensions and hash. Resolve actual file casing/Unicode and known aliases at the asset boundary. Do not compute runtime paths by sanitizing a display name; that would break Pinhead/Cenobite, Ghostface/Ghost Face and future names.

Today's generator already uses deterministic title normalization plus two explicit Killer exceptions, then requires one character match and rejects collisions. Preserve those verified relationships conceptually. Production implementation can decide how the existing portrait maps serve each identity surface after all plans are reviewed; no new schema or duplicate asset tree is requested.

Known mappings worth retaining explicitly:

| Canonical record | Lore filename | Interpretation |
| --- | --- | --- |
| `the-cenobite` / The Cenobite | `Pinhead.png` | Valid explicit asset alias; not a missing file or search-alias feature. |
| `the-ghost-face` / The Ghost Face | `Ghostface.png` | Valid explicit asset alias; joined filename does not match ordinary title normalization. |
| `the-onryo` / The Onryō | `Onryo.png` | Diacritic normalization; exact existing file casing is correct. |
| Remaining 40 mapped Killers | Normalized canonical title without leading The | Standard existing mapping; no renaming needed. |
| `the-slasher` / The Slasher | No Lore file | Keep a deliberate missing entry until a genuine source/approved exception exists. |

The 41 standard normalized-title matches include Onryō. There are **zero ambiguous mappings, duplicate Lore paths or byte-identical Lore files**. No mass filename normalization is warranted.

### Crop / Aspect Ratio Strategy

All 43 Lore images decode as RGBA PNGs with transparent pixels; many include partially transparent edge/body fades. Most are approximately 1:2 portraits, but source dimensions and compositions vary.

| Source characteristic | Measured examples | Display implication |
| --- | --- | --- |
| Common portrait | 18 images exactly 512×1024; Artist 492×984 | Contained image in a shared slot is a reasonable baseline. |
| Narrower portraits | Cannibal 462×1022, Onryō 443×972, Shape 478×1014, Trickster 481×1024 | Preserve masks/faces/weapons; do not stretch to a uniform width. |
| Shorter/wider portrait | Spirit 512×867 | Similar visual weight may need different scale/alignment within the slot. |
| Material aspect outlier | Singularity 1000×1039 (ratio ≈0.962) | Near-square composition needs dedicated fit/focal review; a forced 1:2 cover crop would discard much of the subject. |
| Low-resolution outlier | Good Guy 147×274 | Valid usable Lore source, but aggressive enlargement/high-DPI display can soften it. Review restrained scaling; a higher-resolution authentic Lore version is a future asset-quality task, not a reason to silently switch source. |

Measured aspect range is approximately **0.452–0.962**. Preserve source files as supplied. No preprocessing is required for decoding/mapping. Potential implementation dependencies are non-destructive per-asset scale/object-position metadata after larger-card review, not batch raster crops or renames.

A contained contact-sheet inspection of all 43 against a neutral dark surface showed no obvious cross-character substitution. It also showed different pose scales and source fades; uniform dimensions alone will not equalize recognition. Protect Twins' paired subject, Houndmaster's composition, long head/weapon silhouettes and masks. Do not claim this small-scale inspection validates every future card crop or high-DPI rendering.

### Missing / Ambiguous Lore Assets

The Slasher is the sole missing Lore portrait; no ambiguous/unused extra Lore file was found. A valid existing 512px square portrait is available elsewhere. Recommend a stable neutral “Portrait unavailable” state by default, with the name and navigation fully intact, rather than silently mixing sources. **KR01** records whether to permit that square image as an explicit temporary Slasher-only exception while genuine Lore art is absent. Missing-file acquisition itself is an asset dependency, not a user-design question.

If a mapped Lore file later fails to load, preserve the image slot and readable identity, show the same calm fallback, and keep navigation available. Do not substitute Power icons, another Killer, guessed remote art or generated replacement art.

## Card Information Audit

| Current Information | Keep / Simplify / Move / Remove | Reason |
| --- | --- | --- |
| Current collection portrait | KEEP Lore source; strengthen useful area/fallback | Already correct source for 43 Killers; consistency and presentation need work, not an invented roster asset migration. |
| Name link | KEEP; broaden primary link and strengthen heading | Primary identity/navigation. |
| Favorite button | KEEP secondary independent control | Useful shortlist filter with existing save semantics. |
| Full-width Owned/Locked toggle | SIMPLIFY status; recommend MOVE mutation to character workflow | Reduces accidental edits under broad card navigation; preserve capability. |
| Prestige value/link | KEEP value; SIMPLIFY duplicate link | Scan progression without another identical navigation stop. |
| Bloodweb /50 and thin track | KEEP numbers; SIMPLIFY optional track | Reliable recorded state, grouped with Prestige. |
| Three native names | KEEP compact | Account value without workspace detail. |
| Effective native tiers headed OWNED | SIMPLIFY; recommend explicitly scoped account state | Distinguish native minimum, personal record and account availability. |
| Native-perk dialog buttons | MOVE reference interaction to workspace | Avoid competing card destinations. |
| Effective perk total / Tier III total | MOVE to workspace | Personal inventory analytics are secondary to roster discovery. |
| Add-on type count | REMOVE FROM ROSTER; retain workspace access | No Add-ons or Add-on summaries on this browsing card. Counts are stocked types, not copies. |
| Open workspace footer | KEEP discoverable View Killer cue in primary link | Accurate Overview entry, no extra button-like destination. |
| Power identity (not currently on card) | ADD concise supplied Power name; optional accepted icon | Meaningful Killer-specific identity using existing data, not more analytics. |

No difficulty, tier ranking, kill rate, recommended build, performance analytics or recommendation panels are proposed. No maintained suitable source for those roster jobs was established in this audit.

## Search

Keep a prominent **Search Killers…** field, scoped to the full Killer result set before pagination. Current matching is a case-insensitive substring of canonical name only; it does not search Power names, perk names or licensed identities. Preserve an actual accessible label and Clear search action, with stable focus/caret during updates.

### Alias Search Investigation

Canonical character records expose `id`, `name`, `role` and `nativePerkIds`; the runtime Killer catalog exposes character ID, Power and Add-ons. No maintained character alias/common-name/franchise-search field was found. Existing `perkAliases` are perk identities; collection portrait aliases are filename mappings. Neither is a Killer search vocabulary.

Myers → The Shape and Vecna → The Lich would help recognition for some users, but the current data cannot provide those mappings cleanly. Do not infer aliases from prose, a J. Myers Add-on filename, Power descriptions or image paths, and do not create a manually maintained alias system for this pass. Recommend canonical-name search for Rev02 baseline. A future alias feature would require an intentional maintained source and scope; it is not an approved requirement or blocker here.

## Filters

Match the Survivor proposal: **Search · Filters · Sort**, with ownership (All / Owned / Not owned), Prestige (Any / P0 / P1 / P2 / P3+) and Favorites-only in one small accessible disclosure. These are current supported concepts. Apply dimensions with AND; ownership/Prestige each select one state.

Show compact removable active restrictions below the controls; avoid badges for every default. Reset filters clears ownership/Prestige/Favorites, retaining the visible query and selected sort; Clear search is separate. A zero-result action explicitly clears search and filters. Filters apply before paging and cannot leave an invalid page. Do not introduce Power-category, DLC, difficulty, playstyle or stock filters just because Power text exists; no maintained useful classification for them was established.

## Sorting

Retain current options: Name (default), Prestige descending/ascending, Bloodweb descending, effective perks owned descending and Recently updated. Keep name tie-breaks. Clarify the effective perk sort's meaning even though its totals move off the card.

Recently updated is a saved-edit timestamp, including Favorite/ownership; it does not mean last played or viewed. Sorting resets to page one. No new Power sort is needed for this job.

## Pagination

- Six results after filtering/sorting, independent of column count. The current 44 records produce **eight pages, with two Killers on the last page**. Calculate totals from the catalog rather than hardcode them.
- Remove the proposed roster's 5/10/All display selector. No demonstrated need justifies retaining All on this screen; targeted discovery uses search/filters, and this is a browsing rather than bulk-editing surface.
- Primary pager immediately follows the cards. Show range and page context, for example Showing 7–12 of 44 · Page 2 of 8, or matching-results/catalog-total scopes when filtered.
- Desktop may show a bounded numbered sequence with Previous/Next and current-page semantics. Phone uses Previous / page status / Next where numbered targets would crowd. No unnecessary duplicate top pager, infinite scroll or auto-loading.
- Query/filter/sort changes and resets return to page one. Resizing preserves page/order. Saved/external changes clamp to the last valid page; no matches show zero results and recovery, not Showing 1–0. Hide unnecessary navigation for zero/one page.
- Explicit page changes reveal/focus the new results heading so the user does not remain below the changed grid. Search/filter interactions retain initiating focus and concise result announcements.
- Recommend session-local independent Killer query/filter/sort/page and origin-card restoration on workspace return/browser Back, consistent with the Survivor proposal. Page/role state is not fully captured by today's filter memory; do not assume it is already implemented or add fields to progression saves in this design document.

## Page Header

Integrate counts meaningfully: **Killers** with **44 characters · n owned**, using actual catalog/account totals. Keep matching-result counts distinct near the grid. Remove the detached large numeral and inaccurate direct-edit instruction from the proposal. Final page-heading/count geometry is shared global work, not a Killer-only template.

## Desktop Layout

Three columns maximum, even on ultrawide screens, and two rows for a full page. Equal peer columns serve comparison rather than decorative symmetry. Align controls, grid and pager to one task region; do not stretch every text line or add metrics to fill space.

Reuse the Survivor content-fit exploration: roughly **320px minimum useful card width**, approximately **20px gaps**, three columns at about **1000px inner roster width**, two at about **660px**. At 1366/1440px with today's 220px sidebar and 72px main padding, about 1074/1148px remains, supporting approximately 345/369px cards. At 1280px the same shell leaves 988px; two readable columns are preferable to forcing three.

Explore roughly 1200–1320px task bounding on wider screens to prevent excessively wide peer cards, without changing the global cap. Longer Power/perk names must wrap; the Power line must fit within useful card height. Both rows need not fit every laptop height—avoid shrinking type or clipping artwork to satisfy an above-the-fold rule.

## Tablet Layout

Target two columns × three rows at six items. The current sidebar remains until 760px; at 768px it leaves roughly 527px after 185px sidebar and 56px main padding, insufficient for two 320px cards. A compact shared shell would leave about 728px with 40px gutters, enough for two roughly 354px cards.

This repeats the Survivor/global dependency: release sidebar width earlier in the approximately 700–900px range, subject to shared review. Do not invent Killer-specific global navigation or shrink card facts to preserve a nominal tablet grid. Content fit governs until that shell decision is approved.

## Mobile Layout

One column × six records, same page/order. Search occupies a full row; Filters and labeled Sort share the next row when usable, with active restrictions wrapping below. The small filter form can expand inline rather than require a new drawer system.

Keep recognizable contained artwork, readable name, compact progression, Power name and all three native rows. Avoid repeating desktop image height unchanged where it makes six cards costly to scan. Retain the full Favorite target and reflow long Power/perk names. Pagination follows the last record with readable targets; page changes return to the next set's start. No new sticky roster controls or horizontal card carousel are justified.

## Killer Artwork Coverage

### Current Portrait Audit

**Method:** source baseline `7a3380a`; enumerate all canonical Killer records from `data/catalog.js`; compare checked-in `collectionPortraits` and `portraits` against the read-only generator results; resolve each referenced path component with exact case; read file signatures/dimensions and SHA-256; decode mapped images using Pillow; inspect all Lore images together on a neutral dark contact sheet. Inspect Power names, manifest mappings and confidence from the runtime catalog. Only read-only generator exports were called; the write/build/release entry points were not run.

| Check | Result |
| --- | --- |
| Canonical Killers checked | **44** |
| Roster collection portraits present/valid | **43**, all already under `Killers/Lore` |
| Roster collection portrait missing | **1: The Slasher**, explicit null mapping |
| Mapped roster portraits broken, wrong case/extension/hash/dimensions | **0** |
| Separate workspace identity portraits present/valid | **44**: 35 PNG and 9 WebP runtime files |
| Checked-in versus freshly derived portrait manifest disagreements | **0** for both portrait maps |
| Duplicate paths/byte-identical images within each audited mapped set | **0** |
| Power names | **44 / 44** |
| Power icons mapped and decoded | **37 / 44**: 32 EXACT, 5 REVIEW |
| Power icon gaps | **7**, explicitly MISSING/null |
| Decoded current roster + workspace + Power image references | **124**, zero decode errors |

The roster uses `collectionPortraitPath` → `assetManifest.collectionPortraits`; workspace identity uses `characterPortraitPath` → `assetManifest.portraits`. The latter maps to `images/killer-images` PNGs or `images/portrait-runtime/*.webp` generated from that older source folder. Nine source files with `.png` names actually contain WebP; the existing generator deliberately maps them to proper `.webp` runtime paths. Those resolved runtime files decode and match their hashes; this is handled format normalization, not nine broken portraits.

No character record itself contains a portrait field; image lookup is manifest-based. All referenced local runtime files exist with exact path case, including spaces/diacritics. Local integrity cannot establish current HTTP status/cache/deployment version. Release code explicitly packages non-null collection paths and verifies mapped format/hash/dimensions; it cannot package a nonexistent/null Slasher Lore portrait.

### Lore Portrait Audit

- Directory contains **43 PNG files for 44 Killers**, all mapping to current canonical records; no extra ambiguous file.
- **41** map through normalized title matching, **2** through explicit aliases (Pinhead, Ghostface); The Slasher has no file.
- All 43 are real, decodable PNGs with matching manifest dimensions/hash and exact filename case; all have alpha transparency.
- Dimensions/composition vary as recorded above; Good Guy resolution and Singularity aspect are meaningful display exceptions, not mapping failures.
- No duplicate byte hashes, multiple files for a Killer or obvious wrong-character image was found. Visual contact-sheet review supports identity correspondence; it is not a proof of asset licensing or final crop approval.

### The Slasher Investigation

The local rendering chain explains the reported blank portrait exactly:

1. Canonical `the-slasher` exists in the 44-Killer roster.
2. `images/updated-images/Character Portraits/Killers/Lore` contains no corresponding file or alternate ambiguous candidate.
3. `assetManifest.collectionPortraits['the-slasher']` is explicitly **null**, and the current read-only generator produces the same result.
4. `collectionPortraitPath` returns null. `collectionArtwork` returns an empty string, so **no roster `<img>` is emitted and no portrait request is made for this entry**.
5. The collection does not fall back to `assetManifest.portraits`, so `images/killer-images/the_slasher.png` is not used there. That separate square PNG exists, is 512×512, decodes correctly and is mapped for workspace identity.

Therefore this is **missing Lore coverage plus a deliberate no-fallback rendering path**, not a bad canonical slug, casing error, corrupt referenced image or failure to copy an existing Lore file in the checked-in implementation. The existing collection test explicitly asserts null for this entry. A deployed-version discrepancy would need separate live verification; the source cause already accounts for the visible symptom.

**Usable Slasher Lore portrait: none in the specified directory.** The valid square portrait is an alternative source, not a Lore portrait. Do not rename/copy it into Lore and claim coverage complete. KR01 governs a temporary exception versus neutral fallback; no asset was swapped.

### Power Icon Coverage

All 44 records have a supplied `powerName`. Power artwork paths, including null entries, agree between runtime metadata and the checked-in manifest for every Killer. The existing manifest resolves 37 icon files; all have valid local paths, correct case/hash/dimensions, decode successfully, and have no duplicate byte hashes within the mapped Power set.

Seven gaps: **The Animatronic, The Dark Lord, The First, The Ghoul, The Houndmaster, The Judgment, The Krasue**. Their runtime metadata and manifest explicitly record missing artwork; their Power names remain usable. Do not fill these with Lore portraits, unrelated ability variants or guessed filenames.

Five available icon mappings are qualified REVIEW: **The Clown, The Huntress, The Nemesis, The Slasher, The Xenomorph**. Their mappings are intentional current selections but not promoted to EXACT by this audit. Remaining **32** are labeled EXACT by the current catalog; that label is source metadata rather than an independent re-research of gameplay imagery.

Compact exception table (all other mappings passed the checks above):

| Killer / group | Current roster portrait | Lore portrait | Power icon | Issue / implication |
| --- | --- | --- | --- | --- |
| The Slasher | Missing; null | Missing | Present, REVIEW | No roster image emitted. Valid square workspace alternative exists; source exception/fallback policy pending KR01. |
| The Cenobite | Valid Lore | `Pinhead.png` | Present, EXACT | Known explicit filename alias; keep mapping. |
| The Ghost Face | Valid Lore | `Ghostface.png` | Present, EXACT | Known explicit filename alias; keep mapping. |
| The Onryō | Valid Lore | `Onryo.png` | Present, EXACT | Valid diacritic normalization; preserve canonical name and exact path. |
| The Good Guy | Valid Lore | 147×274 | Present, EXACT | Low source resolution limits enlargement; not a missing asset. |
| The Singularity | Valid Lore | 1000×1039 | Present, EXACT | Aspect/composition outlier; review containment/position. |
| Animatronic, Dark Lord, First, Ghoul, Houndmaster, Judgment, Krasue | Valid Lore for all seven | Present | Missing/null for all seven | Power-name baseline must work without icons. |
| Clown, Huntress, Nemesis, Xenomorph | Valid Lore | Present | Present, REVIEW | Semantic icon review remains qualified; local integrity passes. Slasher REVIEW covered above. |

One relevant filename mismatch is already handled: Slasher's Power display name is **Omnipresent Evil**, while the actual accepted file is `images/Powers and Add-ons/Slasher/With Background/Omniprescent Evil.png`. Huntress, Nemesis and Xenomorph likewise have selected singular/variant filenames. These are mapped existing paths, not broken links; do not derive filenames from display labels or rename assets during this pass.

## Accessibility

- Use meaningful collection/card headings, one real workspace link per card and a sibling Favorite button. Keep keyboard/new-tab behavior and logical row-major focus order; no nested links/buttons or click-only article.
- Provide visible unobscured focus on the broad link and Favorite separately. Keep practical roughly 44px touch targets for Favorite and pagination without letting the star dominate visually.
- Decorative Lore images can have empty alt text when the adjacent name supplies identity. A missing image must preserve the name, action and useful layout; avoid repetitive screen-reader “image unavailable” announcements on every decorative fallback.
- Power name is always text. A redundant icon has empty alt; if it conveys distinct information, label that information explicitly rather than announcing an opaque filename. Missing icon does not remove Power identity or require an empty focusable control.
- Prestige/Bloodweb, ownership, Favorite and perk/access state have text/programmatic meanings independent of color, portrait saturation or diamond backgrounds. General availability versus global tier must be understandable without a tooltip.
- Replace current microtext with readable supporting type; allow long Killer/Power/perk names and large Prestige values to wrap/grow. Contrast targets follow the proposed AA baseline: 4.5:1 normal text, 3:1 large text and essential control/state cues. Final surfaces require later measurement.
- Search, filter groups and sort have real labels; disclosure exposes expanded state; restriction removal/reset names are clear. Announce concise result/page changes without speaking every card on each keystroke.
- Pager has a descriptive navigation label, current-page state, disabled endpoints and adequate target spacing. Explicit page changes and Favorite removal recover useful focus. Search must not steal focus or scroll repeatedly during typing.
- Review 200% text scaling, 400% reflow where applicable, 320px width and physical touch/keyboard later. Protect masks/faces/paired figures under crop/zoom; images should not be the only means of identifying a Killer. Existing sticky-shell focus obstruction remains a shared dependency.
- No drag interaction, animation dependency or hover-only essential content is needed. Paging/search/filter/sort/Favorite actions remain immediate and stable.

## Shared Survivor/Killer Opportunities

| Shared contract | Role-specific responsibility |
| --- | --- |
| Header/account-versus-results counts; search/filter/sort grouping and visible restrictions | Killer search has no maintained common-name aliases; do not infer them from filename mappings. |
| Six-item paging, reset/clamping, 3/2/1 content-fit grid, session return context | Killer current total is 44; Survivor current total is 54. Never hardcode page counts. |
| Broad semantic card link, independent Favorite, ownership status, focus/failure behavior | Killer destination cue can say View Killer; both use canonical Overview entry. |
| Prestige/Bloodweb grammar and explicitly scoped native-perk access | Killer includes a concise Power identity; no Survivor pseudo-Power or forced blank row. |
| Manifest-driven portrait slot and truthful fallback | Killer identity uses Lore-first policy; specific asset aspect/resolution exceptions remain per-character. |
| Text-backed optional identity icons and missing-art states | Power icons remain Power assets; Lore character portraits never substitute for them. |

Do not require identical card height/content between role screens or differentiate them only with blue/red themes. Shared patterns can preserve functional role differences without introducing a component framework. No shared component implementation occurs here.

## Existing-Code Observations

| Source / data inspected | Responsibility / observed dependency |
| --- | --- |
| `src/app.js`: route/render, `collection`, `characterCollectionCard`, `characterMatches` | `#killers` renders the shared collection with Killer role. Card difference today is the stock summary: Killers get Add-on type count; Survivors get Items/Add-ons. Current card has no Power identity. |
| App search/filter/page/Favorite handlers; `src/perk-filters.js` | Name-only matching, current filters/sorts, shared runtime All/5/10 paging, page resets/clamping and route filter memory. Page/size are outside the per-route filter snapshot; role changes reset page. Favorite/ownership use immediate `commit` and timestamps. |
| `src/assets.js`; `data/asset-manifest.json` | Separate `collectionPortraitPath`, `characterPortraitPath`, `killerPowerIconPath`; all ID-keyed. Null collection mapping does not consult square portrait map. |
| `scripts/generate-assets.mjs` | Read-only `generateCollectionPortraitManifest` and `generatePortraitManifest` used for this audit. Lore normalization/explicit aliases, dimensions/hash, collision and role checks. Separate `writeAssetManifest` creates runtime WebP copies/writes manifest; it was not called. |
| `scripts/release.mjs`, collection asset tests | Explicit non-null mapped files are packaged and verified. Existing tests recognize Slasher's missing Lore and expected current coverage. Read for contracts; not run. |
| `data/catalog.js`; `data/killer-perks-audited-10.1.2a-2026-10-05.json` | 44 canonical Killer records derived from perk sources; three native identities and display-name/alias rules. No character alias-search/image field. Perk aliases must not become character aliases. |
| `data/inventory-catalog.js`; `data/killer-runtime-catalog.json` | Exports `killerPowerByCharacterId`; maps Power name/artwork/confidence and Add-ons by canonical ID. All Power names exist, 37 mapped icons, seven null. No maintained Power-category search taxonomy established. |
| `src/model.js`, `src/survivor-collection.js`, workspace route helper | Shared effective/global availability calculations, positive known stock-type selector for Killer Add-ons and canonical character Overview destination. Stock count is not Power identity or total copies. |
| `styles.css` | Shared late collection rules near line 2462: auto-fill 250px minimum/16px gaps, 190px contained hero, dimming/gradient overlays, 112px content offset; name 16px, native heading 8px and row 11px, Favorite 44px. Global sidebar/main breakpoints constrain grid width. |
| `images/updated-images/Character Portraits/Killers/Lore`, `images/killer-images`, mapped `images/portrait-runtime` and Power files | All relevant mapped files checked locally for existence/case/signature/hash/dimensions/decode; Lore contact sheet inspected. No source image was edited, copied into production, renamed or substituted. |

Later dependencies: approved fallback exception, Power icon qualification, source policy across identity surfaces, per-asset fit where needed, shared header/control/focus contracts, tablet shell width, independent per-role navigation state and existing asset/release assumptions. This is not an implementation sequence. No schema change, build, release or new UI dependency is justified by this review.

## Skill-Assisted Findings

Superpowers brainstorming is the primary planning process: inspect actual state, distinguish settled direction from assumptions, compare consequential options, document a reviewable proposal and stop before implementation. Its default implementation handoff/writing-plans step is explicitly deferred by the user's Rev02 process.

Installed guidance inspected earlier in this Rev02 review is reused selectively; no full critique/detector rerun or new agent delegation was necessary.

| Reference | Useful application |
| --- | --- |
| Impeccable Operate | Data truth over appearances: identify the two portrait maps and null-render behavior before describing a migration or broken URL. Keep controls/focus familiar. |
| Taste app-screen guidance | Lore art, Prestige/native-perk access and Power identity earn specificity. Three peer columns are justified by comparison; no arbitrary extra panels or forced role-color themes. |
| UI UX Pro Max focused interaction guidance | Labeled search, meaningful states, keyboard operation and practical target spacing; no generated marketing design-system recipe. |
| Emil design-engineering | Repeated finding/paging actions remain immediate; no animated portraits, counters or staggered grids. |
| Diagram Design applicability | The hierarchy/table and 3×2 / 2×3 / 1×6 notation are sufficient; no separate decorative diagram. |

No skill preference overrides six-per-page, Lore identity direction, semantic tier/rarity color or accessibility. The audit is evidence of local integrity, not a design-approval or gameplay-research certification.

## Open Questions

**KR01 — Missing-Lore fallback policy:** while a Killer has no Lore asset, permit an explicit temporary exception using its valid older character portrait, or show neutral fallback until authentic Lore art is supplied? Recommend neutral fallback as the default; The Slasher is currently the only affected Killer. A permitted exception must be visible in the mapping policy and must not override available Lore imagery. This is a genuine source-consistency decision; the routine missing-file defect remains an asset dependency.

Existing shared choices remain open rather than duplicated: native-perk account scope (W05/Survivor roster), ownership switch removal, and global width/tablet shell (G04/G07). Power name is the proposed baseline; optional icon qualification and measured crop refinements can be handled in later asset/visual review without inventing a user question for each missing file. Alias search is investigated and deferred, not a pending requirement.

## Shared / Global Findings

- **Identity-source policy crosses surfaces:** checked-in roster already uses Lore; workspace uses square portraits. The user's new direction should govern future Killer identity work, without redesigning that workspace now.
- **An absent mapping differs from a failed request:** Slasher emits no `<img>`; a file-not-found/caching diagnosis would be wrong for that source chain. Keep named fallback and decode-failure behavior explicit.
- **Separate asset domains:** portrait, Power, perk and Add-on mappings must retain different meaning. A complete portrait set cannot solve missing Power icons.
- **Availability and tier differ:** General access at global tier zero qualifies the earlier roster account-state recommendation for both roles.
- **Source transparency and pose matter:** uniform image boxes plus extra dimming do not guarantee equal recognition. Avoid destructive preprocessing before actual larger-card review.
- **Counts, controls and navigation are common contracts:** page/range/account scopes, resets/clamping, return state and independent actions should align across rosters.
- **Shared width dependency persists:** a 768px tablet with the existing sidebar cannot fit two readable peer cards; no Killer-only shell workaround is proposed.

### Earlier Plans to Reconsider at Review

The global audit's generic “portraits” wording should distinguish Lore roster art from square workspace art. Its missing Slasher observation is confirmed, not fixed. The Survivor roster native-account-access proposal needs the General exception already recorded by the Survivor workspace review. The new Killer Lore policy supersedes any future assumption that existing square workspace portraits are the desired Killer identity assets; it does not change Survivor sources or authorize edits to prior approved plans. Dashboard hierarchy and queue decisions remain untouched.

These findings feed the later shared/global design document; none is created now.

## Explicit Non-Goals

- No implementation, production code/behavior/CSS changes or asset swaps.
- No Killer workspace redesign yet; only its character-portrait source direction is recorded.
- No Add-ons or Add-on summaries on roster cards; no stock editing here.
- No meta/tier-list/build/difficulty/performance integration or new analytics panels.
- No alias-search subsystem, new dataset or speculative Power categorization.
- No framework/component-library migration, new dependencies or official DBD UI copy.
- No mass asset cleanup, raster preprocessing, invented replacement art or false coverage claims.
- No continued reliance on old Killer portraits where the intended Lore source exists; any missing-source exception requires explicit policy approval.
- No global design-system approval, implementation phases, coding checklist, writing-plans invocation or final implementation roadmap.
