# Character export schema v2

Character exports are informational reports. They are not full-account saves and
cannot be imported through account restore. Canonical account-save schema v3,
migrations, catalogs and account calculations are unchanged.

All five export options use one recorded snapshot. JSON preserves these fields,
in this order; CSV retains its existing rows and columns:

| Field | Contents |
| --- | --- |
| `exportType` | `ledger-character` |
| `exportSchemaVersion` | `2` (incompatible replacement for reference-heavy v1) |
| `exportedAt` | ISO-8601 export timestamp; default UTC |
| `character` | `id`, `name`, `role` (`killer` or `survivor`) |
| `progression` | Recorded `owned`, `favorite`, `prestige`, `bloodwebLevel`, `setupComplete`; false/zero retained; absent optional values omitted |
| `perks` | Only personal records with tier > 0: `{id, name, tier}`; numeric tiers 1–3 |
| `inventory` | Killer: `addons`; Survivor: `items` and `addons`. Arrays of positive recorded `{id, name, quantity}` entries |
| `notes` | Original note text, including line breaks; omitted if absent or whitespace-only |
| `planning` | Only populated entries for this character: `prestige: {position, targetPrestige}`, `playing: {position}`, `upNext: {position, intent}`; omitted when empty |

Queue positions are one-based within the character's role lane. `intent` is
`prestige` or `play`. No other queue members are exported. Missing optional
planning fields are omitted. Empty perk/inventory arrays remain in JSON, while
empty human-readable report sections are omitted.

Perks and inventory entries sort by display name, then stable ID, using a
locale-independent comparison. Catalog lookups supply names only. Unresolved
positive recorded IDs remain as entries with their ID as the fallback name.
Known inventory entries must match the selected character's role/map and, for
Killer add-ons, owner. Perk names use the tracker’s current display naming.

## Human-readable summaries

Copy Summary and Markdown/TXT downloads begin with only the character name,
Prestige and Bloodweb level. Each positive personally recorded perk has one
entry with its name, numeric tier and catalog description. Each positive
recorded item/add-on has one entry with name, rarity, category, quantity and
catalog effect. Survivor Items and Add-ons have separate sections; Killers
have Add-ons. Empty sections and empty notes are omitted. Planning, role,
ownership, favorites, setup status, timestamps and IDs are absent.

The human formatter joins records to the existing catalogs without adding
description fields to JSON/CSV or changing schema v2. Markdown uses headings
and short paragraphs, without tables; TXT uses equivalent plain headings.
Ordinary punctuation and decoded catalog ampersands remain readable. Notes
use a literal fence longer than any backtick run in the note, preserving user
text safely; TXT preserves literal notes. Copy retains its download fallback.

Tier selection uses the personally recorded tier, never account unlocks. A
three-number slash sequence is selected only when all three numeric values
match the same structured field in `tier_1_values`, `tier_2_values` and
`tier_3_values`. Fixed numbers and uncorroborated sequences remain unchanged.
Decimal values and multiple independent sequences are supported. No source
game data is modified and no export-time API request is needed.

Two current catalog exceptions deliberately retain their original wording:

- Hex: Pentimento: `24/28/32` is not corroborated by its structured tier fields.
- Thanatophobia: `4/6/8` is not corroborated by its structured tier fields.

These are source-data inconsistencies, not license to infer balance changes.
Unknown positive recorded IDs remain preserved by the existing snapshot
fallback; absent catalog descriptions/rarities cannot be supplied for them.

CSV uses UTF-8, quoted cells, doubled embedded quotes and CRLF record separators:

```text
Section,Name,Value,Tier,Quantity,ID
```

`Summary` rows cover character name/ID, role, progression and export time.
`Perks` has one row per personal perk, with `Tier` and `ID`. `Items` and `Add-ons`
have one row per positive inventory entry, with `Quantity` and `ID`. Populated
`Notes` and `Planning` use `Value`. Unused columns are empty. User-controlled
formula-like values receive a leading apostrophe, including after whitespace,
control characters or a BOM. Quoting alone is not treated as formula protection.

No account rules/unlock sources, availability/effective/automatic tiers, Bloodweb
calculations, native perk lists, game metadata, Killer Power data, complete
rarity/compatibility catalogs, authentication data or unrelated records are
included. JSON/CSV remain record-only; descriptions and rarity labels are
joined only for human summaries. Exporting does not save, create backups or call APIs. Pending edits
must still be saved/discarded explicitly before exporting.

## Comparable synthetic Dredge example

The fixture in `tests/fixtures/character-export.js` records four personal perks,
three positive add-on quantities, two lines of notes and three planning entries.
For the previous record-only v2 formatter (before human descriptions), the same
fixture and fixed export timestamp produced these historical UTF-8 byte sizes:

| Format | Previous v1 (`f41a7be`) | Compact v2 |
| --- | ---: | ---: |
| JSON | 43,151 | 1,419 |
| Markdown / Copy Summary | 43,101 | 675 |
| TXT | 52,181 | 513 |
| CSV | 67,099 | 1,153 |

CSV has 22 records including its header (23 physical lines because the note
contains a newline). It contains exactly four perk rows and three inventory rows.
These measurements use synthetic data, not a user's private downloads.
