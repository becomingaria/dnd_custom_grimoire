# Grimoire Spell Standard

Every spell in the Grimoire must meet this standard. It lets anyone add spells
(one at a time in the app, or a whole book at once) without the catalogue
drifting into duplicates, typos, or uncredited content.

The rules are code, not just prose: they live in
[`shared/spell-standard.ts`](../shared/spell-standard.ts), and the same module
runs in four places:

| Where | What happens |
| --- | --- |
| Spell form (frontend) | Blocks save and lists what's wrong |
| `POST/PUT /spells` (API) | Normalizes house style, rejects anything with errors |
| `seed-custom-sourcebook.ts` | Refuses to write a book if any spell fails |
| `npm run audit:spells[:db]` | Reports every deviation across the catalogue |

If you change a rule, change it in `spell-standard.ts` and update this page.

---

## 1. Attribution

**Every spell cites at least one source, and every source is in the registry.**

`sources` is an array of registry keys (`["XGtE"]`, `["EEPC", "XGtE"]`). The
registry (`SOURCES` in `spell-standard.ts`) records each book's full title,
publisher, year, kind and licence, so the app can show proper credit instead of
a cryptic abbreviation.

| Kind | Meaning | Examples |
| --- | --- | --- |
| `srd` | Openly licensed rules text | `SRD 5.1` (CC-BY-4.0) |
| `official` | Published by Wizards of the Coast | `PHB`, `XGtE`, `TCoE` |
| `third-party` | Published by someone else | `ItWaW` (author unknown for now) |
| `original` | An original sourcebook written for the Custom Grimoire | `AToW` |
| `homebrew` | Written by a Grimoire member | `Homebrew` |

Rules:

- **SRD 5.1 means the 319 spells in the SRD, and no others.** A PHB spell
  that isn't in the SRD (Hex, Chromatic Orb, the Smites) is `PHB`. The audit
  checks this against `backend/scripts/data/srd-5.1-spell-names.json`.
- **List every book a spell appears in.** Reprints go in the same array
  (`Booming Blade` → `["SCAG", "TCoE"]`). One spell, one entry. Never create a
  second spell because it appears in a second book.
- **Homebrew stands alone.** `["Homebrew"]` can't be combined with a
  published source. Homebrew is credited to its author through `addedBy`
  (their email; shown as `u/name`).
- **`isHomebrew` is derived**: true exactly when `sources` is `["Homebrew"]`.
  The API sets it; don't set it by hand.
- **Homebrew is private by default.** Its author can share it with all
  members (`shared: true`). Published spells are always public. Homebrew without
  a `shared` flag (including older spells) is private. Rules are
  in `backend/lambdas/shared/visibility.ts`.
- **Only admins attribute to published sources.** When a player creates or
  edits a spell, its source is always `Homebrew`.
- **Incomplete attribution is flagged, not hidden.** A registry entry with
  `needsInfo` (unknown author, no link) shows as a warning on every spell from
  that book until someone fills it in.

### SRD licence notice

SRD 5.1 is licensed under CC-BY-4.0, which requires an attribution notice. It's
`SRD_ATTRIBUTION_NOTICE` in `spell-standard.ts` and is rendered in the site
footer. Don't remove it while SRD text is on the site.

---

## 2. Fields

| Field | Required | Rule |
| --- | --- | --- |
| `name` | ✅ | Title Case, ≤ 80 chars. Minor words lowercase: *Toll the Dead*, *Pass without Trace*. Unique across the catalogue. |
| `level` | ✅ | Integer 0–9 (0 = cantrip) |
| `school` | ✅ | One of the eight schools, exactly spelled |
| `castingTime` | ✅ | Lowercase unit: `1 action`, `1 bonus action`, `1 minute`. Reactions include the trigger: `1 reaction, which you take when…` |
| `range` | ✅ | `feet`, never `ft.`: `60 feet`, `Self (15-foot cone)`, `Touch`, `Sight` |
| `components` | ✅ | Ordered subset of `V`, `S`, `M` |
| `materialComponents` | if `M` | Required when `M` is listed, `null` otherwise: `a drop of mercury` |
| `duration` | ✅ | Concentration spells: `Concentration, up to 1 minute`. Others: `Instantaneous`, `1 hour`, `Until dispelled`. Non-concentration "Up to" is valid (Prestidigitation: `Up to 1 hour`). |
| `concentration` | ✅ | Must agree with `duration` |
| `ritual` | ✅ | Boolean |
| `description` | ✅ | Plain text. Paragraphs separated by a blank line; bullets as `* `. No markdown links, HTML, or invisible characters. |
| `higherLevels` | — | Plain text or `null` (never `""`) |
| `classes` | ✅ | At least one of: Artificer, Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard. Sorted. Not subclasses, feats, or "X and Y". |
| `sources` | ✅ | See §1 |
| `damageType` | — | One or more of the 13 damage types, lowercase, comma-separated with the primary type first (`fire` or `piercing, bludgeoning`), or `null`. Read it with `parseDamageTypes()`. |
| `tags` | — | Lowercase strings |

Fields marked *house style* (casing, `ft.`, ordering, whitespace, stray
markdown) are rewritten automatically by `normalizeSpell()` on every save, so
they never need a manual fix. Everything else is an **error** and blocks the
save.

---

## 3. Adding spells

### One spell, in the app

Use **New Spell** on the Spells page. The form enforces this standard. Admins
pick the source from the registry chips; everyone else gets `Homebrew`
credited to themselves.

### A new book

1. **Register the source** in `SOURCES` (`shared/spell-standard.ts`):

   ```ts
   MyBk: {
       abbr: "MyBk",
       title: "My Book of Spells",
       publisher: "Author or Publisher",
       kind: "third-party",
       year: 2026,
       url: "https://link-to-the-original",
   },
   ```

   Use a short, unique key that reads like the title. If you can't find the
   author or a link yet, add `needsInfo: "…what's missing…"` so it stays
   visible in the audit.
2. **Write the spells** as `seed/<book>.json`:

   ```json
   {
     "source": "My Book of Spells",
     "spells": [
       {
         "name": "Arcane Bolt",
         "level": 1,
         "school": "Evocation",
         "casting_time": "1 action",
         "range": "60 feet",
         "components": "V, S, M (a shard of glass)",
         "duration": "Instantaneous",
         "classes": ["Sorcerer", "Wizard"],
         "description": "…",
         "at_higher_levels": "…",
         "ritual": false
       }
     ]
   }
   ```

3. **Dry run**, which validates every spell and writes nothing:
   `npx ts-node --project tsconfig.json scripts/seed-custom-sourcebook.ts seed/<book>.json MyBk --dry-run`
4. **Seed**: the same command without `--dry-run`. Add an `npm run seed:<key>`
   alias in `backend/package.json` if you'll re-run it.
5. **Audit and export**: `npm run audit:spells:db`, then
   `npm run export:spells` so `seed/spells.json` matches the table.

### Checklist

- [ ] Source key exists in the registry with title + publisher
- [ ] Not a duplicate: search the Grimoire by name first; if it exists, add your
      book to its `sources` instead
- [ ] Text copied faithfully (no truncated first paragraph, no text pasted from a
      neighbouring spell). The audit flags descriptions shared by two spells.
- [ ] `audit:spells` reports 0 errors

---

## 4. Commands (run in `backend/`)

| Command | Purpose |
| --- | --- |
| `npm run audit:spells` | Audit `seed/spells.json` |
| `npm run audit:spells:db` | Audit the live table, including homebrew |
| `npm run fix:spells:file [-- --apply]` | Bring `seed/spells.json` up to standard |
| `npm run fix:spells:db [-- --apply]` | Bring the live table up to standard and re-point characters for merged duplicates |
| `npm run export:spells` | Snapshot the table to `seed/spells.json` |

`fix:*` scripts are dry runs unless `--apply` is passed. They're idempotent:
running them again changes nothing.

The **Admin → Spell Attribution** tab shows the same audit in the app, with an
Edit button on each spell that needs fixing.
