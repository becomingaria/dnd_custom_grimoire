/**
 * seed-class-spells.ts
 *
 * Seeds spells from the class-based JSON files in seed/, filtering out
 * sources that have already been seeded (PHB, XGtE, TCoE, EE, SCAG).
 *
 * Each file has the shape:
 *   [{ class, name, source, level, casting, range, components, duration, description }, ...]
 *
 * Spells are deduplicated by (name, source) across all class files.
 * Classes are aggregated from all files where the spell appears.
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/seed-class-spells.ts [--dry-run]
 *
 * Examples:
 *   npm run seed:class
 *   npm run seed:class:dry
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const DRY_RUN = process.argv.includes("--dry-run")

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

// ─── Source name → abbreviation ─────────────────────────────────────────────
// Maps the full source name stored in the class JSON files to the canonical
// abbreviation used in DynamoDB.

const SOURCE_LABELS: Record<string, string> = {
    "Acquisitions Inc.": "AI",
    "Explorer's Guide to Wildemount": "EGtW",
    "Fizban's Treasury of Dragons": "FToD",
    "Guildmaster's Guide to Ravnica": "GGtR",
    "Icewind Dale - Rime of the Frostmaiden": "ROtF",
    "Lost Laboratory of Kwalish": "LLoK",
    Strixhaven: "SCoC",
}

// ─── Sources to skip (already seeded) ─────────────────────────────────────────

const SKIP_SOURCES = new Set([
    "Player's Handbook",
    "Xanathar's Guide to Everything",
    "Tasha's Cauldron of Everything",
    "Elemental Evil Player's Companion",
    "Sword Coast Adventurer's Guide",
    "Xanathar's Guide to Everything/Elemental Evil Player's Companion",
    "Tasha's Cauldron of Everything/Sword Coast Adventurer's Guide",
])

// ─── School lookup ─────────────────────────────────────────────────────────────
// Class spell files don't include school; this map covers all 40 unique spells
// found across the 8 class files for non-PHB/XGtE/TCoE sources.

const SCHOOL_LOOKUP: Record<string, string> = {
    // Acquisitions Inc.
    "Distort Value": "Illusion",
    "Fast Friends": "Enchantment",
    "Gift of Gab": "Enchantment",
    "Incite Greed": "Enchantment",
    "Jim's Glowing Coin": "Illusion",
    "Jim's Magic Missile": "Evocation",
    "Motivational Speech": "Enchantment",

    // Explorer's Guide to Wildemount
    "Dark Star": "Evocation",
    "Fortune's Favor": "Divination",
    "Gift of Alacrity": "Divination",
    "Gravity Fissure": "Evocation",
    "Gravity Sinkhole": "Evocation",
    "Immovable Object": "Transmutation",
    "Magnify Gravity": "Evocation",
    "Pulse Wave": "Evocation",
    "Ravenous Void": "Evocation",
    "Reality Break": "Conjuration",
    "Sapping Sting": "Necromancy",
    "Temporal Shunt": "Transmutation",
    "Tether Essence": "Necromancy",
    "Time Ravage": "Necromancy",
    Wristpocket: "Conjuration",

    // Fizban's Treasury of Dragons
    "Ashardalon's Stride": "Transmutation",
    "Draconic Transformation": "Transmutation",
    "Fizban's Platinum Shield": "Abjuration",
    "Nathair's Mischief": "Illusion",
    "Raulothim's Psychic Lance": "Enchantment",
    "Rime's Binding Ice": "Evocation",
    "Summon Draconic Spirit": "Conjuration",

    // Guildmaster's Guide to Ravnica
    "Encode Thoughts": "Enchantment",

    // Icewind Dale - Rime of the Frostmaiden
    "Create Magen": "Transmutation",
    "Frost Fingers": "Evocation",

    // Lost Laboratory of Kwalish
    "Flock of Familiars": "Conjuration",
    "Galder's Speedy Courier": "Conjuration",
    "Galder's Tower": "Conjuration",

    // Strixhaven
    "Borrowed Knowledge": "Divination",
    "Kinetic Jaunt": "Transmutation",
    "Silvery Barbs": "Enchantment",
    "Vortex Warp": "Conjuration",
    "Wither and Bloom": "Necromancy",
}

// ─── Raw spell shape from class files ─────────────────────────────────────────

interface RawClassSpell {
    class: string
    name: string
    source: string
    level: number
    casting: string
    range: string
    components: string
    duration: string
    description: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

function parseComponents(raw: string): {
    components: string[]
    materialComponents: string | null
} {
    const found = raw.match(/\b[VSM]\b/g) ?? []
    const components = [...new Set(found)]
    const fromParens = raw.match(/\(([^)]+)\)/)?.[1]?.trim() ?? null
    return { components, materialComponents: fromParens }
}

function isConcentration(duration: string): boolean {
    return duration.toLowerCase().includes("concentration")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface MergedSpell {
    name: string
    source: string
    level: number
    casting: string
    range: string
    components: string
    duration: string
    description: string
    classes: Set<string>
}

async function main() {
    const seedDir = path.join(__dirname, "..", "seed")
    const classFiles = fs
        .readdirSync(seedDir)
        .filter((f) => f.endsWith("_spells.json"))
        .map((f) => path.join(seedDir, f))

    if (classFiles.length === 0) {
        console.error("No *_spells.json files found in seed/")
        process.exit(1)
    }

    // ── Merge all class files, dedup by (name, source) ──────────────────────
    const merged = new Map<string, MergedSpell>()

    for (const filePath of classFiles) {
        const className = path.basename(filePath).replace("_spells.json", "")
        const capitalizedClass =
            className.charAt(0).toUpperCase() + className.slice(1)

        const spells = JSON.parse(
            fs.readFileSync(filePath, "utf-8"),
        ) as RawClassSpell[]

        for (const s of spells) {
            if (SKIP_SOURCES.has(s.source)) continue

            const key = `${s.name}||${s.source}`
            if (!merged.has(key)) {
                merged.set(key, {
                    name: s.name,
                    source: SOURCE_LABELS[s.source] ?? s.source,
                    level: s.level,
                    casting: s.casting,
                    range: s.range,
                    components: s.components,
                    duration: s.duration,
                    description: s.description,
                    classes: new Set(),
                })
            }
            merged.get(key)!.classes.add(capitalizedClass)
        }
    }

    console.log(`\n📚 Class spell files scanned: ${classFiles.length}`)
    console.log(
        `   Unique new spells found: ${merged.size}${DRY_RUN ? "  [DRY RUN]" : ""}`,
    )

    const now = new Date().toISOString()
    let seeded = 0
    let skipped = 0
    let failed = 0

    for (const spell of merged.values()) {
        const name = spell.name.trim()
        if (!name) {
            skipped++
            continue
        }

        const school = SCHOOL_LOOKUP[name] ?? "Transmutation"
        const { components, materialComponents } = parseComponents(
            spell.components ?? "",
        )
        const duration = (spell.duration ?? "Instantaneous").trim()
        const sourceId = slugify(spell.source) // source is already abbreviated at this point

        const item: Record<string, unknown> = {
            spellId: `${sourceId}-${slugify(name)}`,
            name,
            level: spell.level,
            school,
            castingTime: (spell.casting ?? "1 action").trim(),
            range: (spell.range ?? "Self").trim(),
            components,
            materialComponents,
            duration,
            concentration: isConcentration(duration),
            ritual: false,
            description: spell.description ?? "",
            higherLevels: null,
            classes: [...spell.classes].sort(),
            isHomebrew: false,
            source: spell.source,
            tags: [],
            damageType: null,
            addedBy: "system",
            createdBy: "system",
            changelog: [],
            createdAt: now,
            updatedAt: now,
        }

        if (DRY_RUN) {
            console.log(
                `  [dry] ${name}  (${spell.source})  [${school}]  classes: ${[...spell.classes].sort().join(", ")}`,
            )
            seeded++
            continue
        }

        try {
            await docClient.send(
                new PutCommand({ TableName: SPELLS_TABLE, Item: item }),
            )
            console.log(`  ✅ ${name}  (${spell.source})`)
            seeded++
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ ${name}: ${msg}`)
            failed++
        }
    }

    console.log(`\n─────────────────────────────────`)
    if (DRY_RUN) {
        console.log(`Would seed: ${seeded}  |  Skipped: ${skipped}`)
    } else {
        console.log(
            `Seeded: ${seeded}  |  Skipped: ${skipped}  |  Failed: ${failed}`,
        )
    }
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
