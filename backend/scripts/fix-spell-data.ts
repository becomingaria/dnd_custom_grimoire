/**
 * fix-spell-data.ts
 *
 * Brings existing spells up to the Grimoire spell standard
 * (shared/spell-standard.ts, docs/SPELL_STANDARD.md):
 *
 *   1. Attribution — spells that cite "SRD 5.1" but are not in the SRD lose
 *      that citation; if nothing is left they are attributed to the PHB.
 *      Legacy `source` strings become `sources` arrays.
 *   2. Corrections — hand-verified fixes for corrupted text/fields, restored
 *      from the SRD 5.1 (CC-BY-4.0).
 *   3. Merges — misspelled duplicates are folded into the correct spell;
 *      characters that referenced the duplicate are re-pointed.
 *   4. Normalization — normalizeSpell() house-style cleanup on every spell.
 *
 * Every run is a dry run unless --apply is passed.
 *
 * Usage:
 *   npm run fix:spells:file              # preview changes to seed/spells.json
 *   npm run fix:spells:file -- --apply   # rewrite seed/spells.json
 *   npm run fix:spells:db                # preview changes to the live table
 *   npm run fix:spells:db -- --apply     # write to the live table + characters
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    DeleteCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import {
    normalizeSpell,
    normalizeSources,
    HOMEBREW_SOURCE,
    SRD_SOURCE,
    type StandardSpell,
} from "../../shared/spell-standard"
import srdData from "./data/srd-5.1-spell-names.json"

dotenv.config({ path: path.join(__dirname, "../.env") })

const args = process.argv.slice(2)
const USE_DB = args.includes("--db")
const APPLY = args.includes("--apply")
const fileArgIdx = args.indexOf("--file")
const FILE =
    fileArgIdx >= 0 && args[fileArgIdx + 1] && !args[fileArgIdx + 1].startsWith("--")
        ? path.resolve(args[fileArgIdx + 1])
        : path.join(__dirname, "..", "seed", "spells.json")

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE ?? "grimoire-characters"
const REGION = process.env.AWS_REGION ?? "us-east-1"
const FIXED_BY = "system:fix-spell-data"

type SpellRecord = StandardSpell & {
    spellId: string
    source?: string
    changelog?: { updatedBy: string; updatedAt: string }[]
    [key: string]: unknown
}

const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "")
const SRD_NAMES = new Set(srdData.names.map(nameKey))

// ─── Hand-verified corrections ────────────────────────────────────────────────
// Keyed by the spell's *current* name. Each patch is idempotent: running the
// script twice produces no further changes.

type Patch = {
    reason: string
    apply: (s: SpellRecord) => Partial<SpellRecord>
}

const prepend = (text: string, para: string) =>
    text.startsWith(para) ? text : `${para}\n\n${text}`
const append = (text: string, para: string) =>
    text.trimEnd().endsWith(para) ? text : `${text.trimEnd()} ${para}`
const replace = (text: string, from: string, to: string) =>
    text.split(from).join(to)

const CORRECTIONS: Record<string, Patch[]> = {
    "Summon Aberration": [
        { reason: "school typo", apply: () => ({ school: "Conjuration" }) },
    ],
    "Floating Disk": [
        {
            reason: "description was Hideous Laughter's; material missing (SRD 5.1)",
            apply: () => ({
                materialComponents: "a drop of mercury",
                description: [
                    "This spell creates a circular, horizontal plane of force, 3 feet in diameter and 1 inch thick, that floats 3 feet above the ground in an unoccupied space of your choice that you can see within range. The disk remains for the duration, and can hold up to 500 pounds. If more weight is placed on it, the spell ends, and everything on the disk falls to the ground.",
                    "The disk is immobile while you are within 20 feet of it. If you move more than 20 feet away from it, the disk follows you so that it remains within 20 feet of you. It can move across uneven terrain, up or down stairs, slopes and the like, but it can't cross an elevation change of 10 feet or more. For example, the disk can't move across a 10-foot-deep pit, nor could it leave such a pit if it was created at the bottom.",
                    "If you move more than 100 feet away from the disk (typically because it can't move around an obstacle to follow you), the spell ends.",
                ].join("\n\n"),
            }),
        },
    ],
    "Hideous Laughter": [
        {
            reason: "material missing (SRD 5.1)",
            apply: () => ({
                materialComponents:
                    "tiny tarts and a feather that is waved in the air",
            }),
        },
    ],
    "Telepathic Bond": [
        {
            reason: "material missing (SRD 5.1)",
            apply: () => ({
                materialComponents:
                    "pieces of eggshell from two different kinds of creatures",
            }),
        },
    ],
    "Secret Chest": [
        {
            reason: "description was Instant Summons' (SRD 5.1)",
            apply: () => ({
                description: [
                    "You hide a chest, and all its contents, on the Ethereal Plane. You must touch the chest and the miniature replica that serves as a material component for the spell. The chest can contain up to 12 cubic feet of nonliving material (3 feet by 2 feet by 2 feet).",
                    "While the chest remains on the Ethereal Plane, you can use an action and touch the replica to recall the chest. It appears in an unoccupied space on the ground within 5 feet of you. You can send the chest back to the Ethereal Plane by using an action and touching both the chest and the replica.",
                    "After 60 days, there is a cumulative 5 percent chance per day that the spell's effect ends. This effect ends if you cast this spell again, if the smaller replica chest is destroyed, or if you choose to end the spell as an action. If the spell ends and the larger chest is on the Ethereal Plane, it is irretrievably lost.",
                ].join("\n\n"),
            }),
        },
    ],
    "Bestow Curse": [
        {
            reason: "opening paragraph missing (SRD 5.1)",
            apply: (s) => ({
                description: prepend(
                    s.description,
                    "You touch a creature, and that creature must succeed on a Wisdom saving throw or become cursed for the duration of the spell. When you cast this spell, choose the nature of the curse from the following options:",
                ),
            }),
        },
    ],
    "Find Familiar": [
        {
            reason: "opening paragraph missing (SRD 5.1)",
            apply: (s) => ({
                description: prepend(
                    s.description,
                    "You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel. Appearing in an unoccupied space within range, the familiar has the statistics of the chosen form, though it is a celestial, fey, or fiend (your choice) instead of a beast.",
                ),
            }),
        },
    ],
    Silence: [
        {
            reason: "final sentence missing (SRD 5.1)",
            apply: (s) => ({
                description: append(
                    s.description,
                    "Casting a spell that includes a verbal component is impossible there.",
                ),
            }),
        },
    ],
    "Arcane Sword": [
        {
            reason: "duplicated paragraph and stray capitals (SRD 5.1)",
            apply: () => ({
                description: [
                    "You create a sword-shaped plane of force that hovers within range. It lasts for the duration.",
                    "When the sword appears, you make a melee spell attack against a target of your choice within 5 feet of the sword. On a hit, the target takes 3d10 force damage. Until the spell ends, you can use a bonus action on each of your turns to move the sword up to 20 feet to a spot you can see and repeat this attack against the same target or a different one.",
                ].join("\n\n"),
            }),
        },
    ],
    Alarm: [
        {
            reason: "casting time is 1 minute (SRD 5.1)",
            apply: () => ({ castingTime: "1 minute" }),
        },
    ],
    "Acid Arrow": [
        {
            reason: "casting time/range were another spell's (SRD 5.1)",
            apply: () => ({ castingTime: "1 action", range: "90 feet" }),
        },
    ],
    "Continual Flame": [
        { reason: "range is Touch (SRD 5.1)", apply: () => ({ range: "Touch" }) },
    ],
    "Purify Food and Drink": [
        { reason: "is a ritual (SRD 5.1)", apply: () => ({ ritual: true }) },
    ],
    "Hold Person": [
        { reason: "is not a ritual (SRD 5.1)", apply: () => ({ ritual: false }) },
    ],
    "Protection from Energy": [
        {
            reason: "duration is up to 1 hour (SRD 5.1)",
            apply: () => ({
                duration: "Concentration, up to 1 hour",
                concentration: true,
            }),
        },
    ],
    "Meld into Stone": [
        {
            reason: "typo",
            apply: (s) => ({
                description: replace(s.description, "tofully", "to fully"),
            }),
        },
    ],
    "Speak with Dead": [
        {
            reason: "typo",
            apply: (s) => ({
                description: replace(s.description, "o f life", "of life"),
            }),
        },
    ],
    "Resilient Sphere": [
        {
            reason: "typo",
            apply: (s) => ({
                description: replace(s.description, "A s phere", "A sphere"),
            }),
        },
    ],
    "Finger of Death": [
        {
            reason: "typo",
            apply: (s) => ({
                description: replace(s.description, "engery", "energy"),
            }),
        },
    ],
    "Mirage Arcane": [
        {
            reason: "typo",
            apply: (s) => ({
                description: replace(s.description, " a area", " an area"),
            }),
        },
    ],
}

/** Misspelled duplicates → the correctly spelled spell they fold into. */
const MERGES: { from: string; into: string }[] = [
    { from: "Abi-Dalzim's Horrid Writing", into: "Abi-Dalzim's Horrid Wilting" },
    { from: "Maximillan's Earthen Grasp", into: "Maximilian's Earthen Grasp" },
]

// ─── Planning (pure) ──────────────────────────────────────────────────────────

export interface FixPlan {
    updated: Map<string, SpellRecord>
    deleted: { spellId: string; name: string; mergedInto: string }[]
    log: string[]
}

function fixAttribution(s: SpellRecord): string[] {
    let sources = Array.isArray(s.sources)
        ? [...s.sources]
        : typeof s.source === "string" && s.source
          ? [s.source]
          : []
    if (sources.length === 0 && s.isHomebrew) sources = [HOMEBREW_SOURCE]

    if (sources.includes(SRD_SOURCE) && !SRD_NAMES.has(nameKey(s.name))) {
        sources = sources.filter((x) => x !== SRD_SOURCE)
        if (sources.length === 0) sources = ["PHB"]
    }
    return normalizeSources(sources)
}

export function planFixes(input: SpellRecord[]): FixPlan {
    const log: string[] = []
    const byId = new Map(input.map((s) => [s.spellId, structuredClone(s)]))
    const byName = new Map(input.map((s) => [s.name, s.spellId]))
    const deleted: FixPlan["deleted"] = []

    // 1. Merges
    for (const { from, into } of MERGES) {
        const fromId = byName.get(from)
        const intoId = byName.get(into)
        if (!fromId || !intoId) continue
        const loser = byId.get(fromId)!
        const winner = byId.get(intoId)!
        winner.sources = [
            ...new Set([...(winner.sources ?? []), ...(loser.sources ?? [])]),
        ]
        winner.classes = [
            ...new Set([...(winner.classes ?? []), ...(loser.classes ?? [])]),
        ]
        byId.delete(fromId)
        deleted.push({ spellId: fromId, name: from, mergedInto: intoId })
        log.push(`merge   "${from}" → "${into}"`)
    }

    // 2–4. Attribution, corrections, normalization
    const updated = new Map<string, SpellRecord>()
    for (const [id, original] of byId) {
        // Normalize first so corrections match clean text (no invisible chars)
        let s: SpellRecord = normalizeSpell({
            ...original,
            sources: fixAttribution(original),
        })
        if ("source" in s) delete s.source

        for (const patch of CORRECTIONS[original.name] ?? []) {
            const next = { ...s, ...patch.apply(s) }
            if (JSON.stringify(next) !== JSON.stringify(s))
                log.push(`correct "${original.name}": ${patch.reason}`)
            s = next
        }
        s = normalizeSpell(s)
        if (s.isHomebrew === undefined)
            s.isHomebrew = s.sources.includes(HOMEBREW_SOURCE)

        const before = input.find((x) => x.spellId === id)!
        if (JSON.stringify(s) !== JSON.stringify(before)) {
            updated.set(id, s)
            const changed = Object.keys({ ...before, ...s }).filter(
                (k) =>
                    JSON.stringify(before[k]) !== JSON.stringify(s[k]),
            )
            if (
                JSON.stringify(before.sources) !== JSON.stringify(s.sources)
            ) {
                log.push(
                    `source  "${s.name}": ${JSON.stringify(before.sources ?? before.source ?? null)} → ${JSON.stringify(s.sources)}`,
                )
            }
            log.push(`update  "${s.name}" [${changed.join(", ")}]`)
        }
    }
    return { updated, deleted, log }
}

// ─── IO ───────────────────────────────────────────────────────────────────────

async function runOnFile() {
    const spells = JSON.parse(fs.readFileSync(FILE, "utf-8")) as SpellRecord[]
    const plan = planFixes(spells)
    report(plan, spells.length)
    if (!APPLY) return

    const deletedIds = new Set(plan.deleted.map((d) => d.spellId))
    const out = spells
        .filter((s) => !deletedIds.has(s.spellId))
        .map((s) => plan.updated.get(s.spellId) ?? s)
        .sort((a, b) =>
            a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name),
        )
    fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n", "utf-8")
    console.log(`\n✅ Wrote ${out.length} spells to ${path.relative(process.cwd(), FILE)}`)
}

async function scanAll<T>(
    doc: DynamoDBDocumentClient,
    table: string,
): Promise<T[]> {
    const all: T[] = []
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await doc.send(
            new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }),
        )
        all.push(...((r.Items ?? []) as T[]))
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)
    return all
}

async function runOnDb() {
    const doc = DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: REGION }),
        { marshallOptions: { removeUndefinedValues: true } },
    )
    const spells = await scanAll<SpellRecord>(doc, SPELLS_TABLE)
    const plan = planFixes(spells)
    report(plan, spells.length)

    type CharacterRecord = {
        characterId: string
        name: string
        knownSpellIds?: string[]
        preparedSpellIds?: string[]
        spellNotes?: Record<string, string>
    }
    const remap = new Map(plan.deleted.map((d) => [d.spellId, d.mergedInto]))
    const characters = remap.size
        ? await scanAll<CharacterRecord>(doc, CHARACTERS_TABLE)
        : []
    const charUpdates = characters
        .map((c) => {
            const fix = (ids?: string[]) =>
                ids ? [...new Set(ids.map((id) => remap.get(id) ?? id))] : ids
            const notes = c.spellNotes
                ? Object.fromEntries(
                      Object.entries(c.spellNotes).map(([k, v]) => [
                          remap.get(k) ?? k,
                          v,
                      ]),
                  )
                : c.spellNotes
            const next = {
                knownSpellIds: fix(c.knownSpellIds),
                preparedSpellIds: fix(c.preparedSpellIds),
                spellNotes: notes,
            }
            const changed =
                JSON.stringify(next.knownSpellIds) !==
                    JSON.stringify(c.knownSpellIds) ||
                JSON.stringify(next.preparedSpellIds) !==
                    JSON.stringify(c.preparedSpellIds) ||
                JSON.stringify(next.spellNotes) !== JSON.stringify(c.spellNotes)
            return changed ? { c, next } : null
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    for (const { c } of charUpdates)
        console.log(`  character "${c.name}" references a merged spell — will re-point`)

    if (!APPLY) {
        console.log("\n🔍 Dry run — re-run with --apply to write these changes.")
        return
    }

    const now = new Date().toISOString()
    for (const s of plan.updated.values()) {
        await doc.send(
            new PutCommand({
                TableName: SPELLS_TABLE,
                Item: {
                    ...s,
                    updatedAt: now,
                    changelog: [
                        ...(s.changelog ?? []),
                        { updatedBy: FIXED_BY, updatedAt: now },
                    ],
                },
            }),
        )
    }
    // Re-point characters before deleting so nothing ever dangles.
    for (const { c, next } of charUpdates) {
        await doc.send(
            new UpdateCommand({
                TableName: CHARACTERS_TABLE,
                Key: { characterId: c.characterId },
                UpdateExpression:
                    "SET knownSpellIds = :k, preparedSpellIds = :p, spellNotes = :n, updatedAt = :u",
                ExpressionAttributeValues: {
                    ":k": next.knownSpellIds ?? [],
                    ":p": next.preparedSpellIds ?? [],
                    ":n": next.spellNotes ?? {},
                    ":u": now,
                },
            }),
        )
    }
    for (const d of plan.deleted) {
        await doc.send(
            new DeleteCommand({
                TableName: SPELLS_TABLE,
                Key: { spellId: d.spellId },
            }),
        )
    }
    console.log(
        `\n✅ Updated ${plan.updated.size} spells, merged ${plan.deleted.length}, re-pointed ${charUpdates.length} characters.`,
    )
}

function report(plan: FixPlan, total: number) {
    const mode = USE_DB ? `table ${SPELLS_TABLE}` : path.relative(process.cwd(), FILE)
    console.log(
        `\n🛠  ${APPLY ? "APPLYING" : "DRY RUN"} — ${mode} (${total} spells)\n`,
    )
    const interesting = plan.log.filter((l) => !l.startsWith("update"))
    for (const line of interesting) console.log(`  ${line}`)
    const updates = plan.log.filter((l) => l.startsWith("update")).length
    console.log(
        `\n  ${plan.updated.size} spells change (${updates} total), ${plan.deleted.length} merged away.`,
    )
    if (args.includes("--verbose"))
        for (const line of plan.log.filter((l) => l.startsWith("update")))
            console.log(`  ${line}`)
}

if (require.main === module) {
    ;(USE_DB ? runOnDb() : runOnFile()).catch((err) => {
        console.error(err)
        process.exit(1)
    })
}
