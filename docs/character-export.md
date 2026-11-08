# Character export schema v2

Character exports are informational reports. They are not full-account saves and
cannot be imported through account restore. Canonical account-save schema v3,
migrations, catalogs and account calculations are unchanged.

All five export options use one snapshot with these fields, in this order:

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

Markdown/TXT use Roman personal tiers (I–III); JSON/CSV use numeric tiers.
Markdown leaves ordinary hyphens, periods and ampersands readable and escapes
table syntax only as needed. Notes use a literal fence longer than any backtick
run in the note, preserving text without allowing headings, links or HTML to
change report structure. TXT uses aligned name/value rows, not per-field blocks.
Copy Summary uses the same Markdown formatter and retains download fallback.

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
calculations, native perk lists, game metadata, descriptions, Killer Power data,
rarity/compatibility catalogs, authentication data or unrelated records are
included. Exporting does not save, create backups or call APIs. Pending edits
must still be saved/discarded explicitly before exporting.

## Comparable synthetic Dredge example

The fixture in `tests/fixtures/character-export.js` records four personal perks,
three positive add-on quantities, two lines of notes and three planning entries.
With the same fixture and fixed export timestamp, UTF-8 byte sizes are:

| Format | Previous v1 (`f41a7be`) | Compact v2 |
| --- | ---: | ---: |
| JSON | 43,151 | 1,419 |
| Markdown / Copy Summary | 43,101 | 675 |
| TXT | 52,181 | 513 |
| CSV | 67,099 | 1,153 |

CSV has 22 records including its header (23 physical lines because the note
contains a newline). It contains exactly four perk rows and three inventory rows.
These measurements use synthetic data, not a user's private downloads.
