/**
 * seed-5etools-filtered.ts
 *
 * Seeds spells from a 5etools-style flat JSON array, filtering to only
 * spells whose "page" field starts with a specified source prefix.
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/seed-5etools-filtered.ts <inputFile> <pagePrefix> <sourceLabel> [--dry-run]
 *
 * Examples:
 *   npm run seed:ee
 *   npm run seed:scag
 *   npm run seed:ee -- --dry-run
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const [, , inputFileArg, pagePrefixArg, sourceLabelArg] = process.argv
const DRY_RUN = process.argv.includes("--dry-run")

if (!inputFileArg || !pagePrefixArg || !sourceLabelArg) {
    console.error(
        "Usage: ts-node seed-5etools-filtered.ts <inputFile> <pagePrefix> <sourceLabel> [--dry-run]",
    )
    process.exit(1)
}

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

interface RawSpell {
    name: string
    desc: string
    higher_level?: string
    page?: string
    range: string
    components: string
    material?: string
    ritual: string
    duration: string
    concentration: string
    casting_time: string
    level: string
    school: string
    class: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

function parseLevel(raw: string): number {
    const lower = raw.toLowerCase().trim()
    if (lower === "cantrip") return 0
    const m = lower.match(/^(\d+)/)
    if (m) return parseInt(m[1], 10)
    return 0
}

function normalizeSchool(raw: string): string {
    const s = raw.trim()
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function parseComponents(raw: string, material?: string): {
    components: string[]
    materialComponents: string | null
} {
    const found = raw.match(/\b[VSM]\b/g) ?? []
    const components = [...new Set(found)]

    // prefer explicit material field, then fall back to parenthetical in components string
    const fromParens = raw.match(/\(([^)]+)\)/)?.[1]?.trim() ?? null
    const materialComponents = material?.trim() || fromParens || null

    return { components, materialComponents }
}

function isConcentration(raw: string, duration: string): boolean {
    return (
        raw.trim().toLowerCase() === "yes" ||
        duration.toLowerCase().includes("concentration")
    )
}

function isRitual(raw: string): boolean {
    return raw.trim().toLowerCase() === "yes"
}

function stripHtml(raw: string): string {
    return raw.replace(/<[^>]+>/g, "").trim()
}

function parseClasses(raw: string): string[] {
    return raw
        .split(",")
        .map((c) => {
            const trimmed = c.trim()
            // normalise "Wizards" → "Wizard"
            return trimmed === "Wizards" ? "Wizard" : trimmed
        })
        .filter(Boolean)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const inputFile = path.isAbsolute(inputFileArg)
        ? inputFileArg
        : path.join(__dirname, "..", inputFileArg)

    const pagePrefix = pagePrefixArg.toLowerCase().trim()
    const sourceLabel = sourceLabelArg.trim()

    const all = JSON.parse(fs.readFileSync(inputFile, "utf-8")) as RawSpell[]

    if (!Array.isArray(all)) {
        console.error("Expected a JSON array at root.")
        process.exit(1)
    }

    const filtered = all.filter((s) =>
        (s.page ?? "").toLowerCase().startsWith(pagePrefix),
    )

    console.log(
        `\n📖 Source filter: "${pagePrefix}"  →  label: "${sourceLabel}"`,
    )
    console.log(
        `   Total spells in file: ${all.length}  |  Matching: ${filtered.length}${DRY_RUN ? "  [DRY RUN]" : ""}`,
    )

    const now = new Date().toISOString()
    const sourceId = slugify(sourceLabel)

    let seeded = 0
    let skipped = 0
    let failed = 0

    for (const raw of filtered) {
        const name = raw.name?.trim()
        if (!name) {
            skipped++
            continue
        }

        const { components, materialComponents } = parseComponents(
            raw.components ?? "",
            raw.material,
        )
        const duration = (raw.duration ?? "Instantaneous").trim()

        const item: Record<string, unknown> = {
            spellId: `${sourceId}-${slugify(name)}`,
            name,
            level: parseLevel(raw.level),
            school: normalizeSchool(raw.school),
            castingTime: (raw.casting_time ?? "1 action").trim(),
            range: (raw.range ?? "Self").trim(),
            components,
            materialComponents,
            duration,
            concentration: isConcentration(raw.concentration ?? "no", duration),
            ritual: isRitual(raw.ritual ?? "no"),
            description: stripHtml(raw.desc ?? ""),
            higherLevels: raw.higher_level ? stripHtml(raw.higher_level) : null,
            classes: parseClasses(raw.class ?? ""),
            isHomebrew: false,
            source: sourceLabel,
            tags: [],
            damageType: null,
            addedBy: "system",
            createdBy: "system",
            changelog: [],
            createdAt: now,
            updatedAt: now,
        }

        if (DRY_RUN) {
            console.log(`  [dry] ${name}  (${sourceLabel})`)
            seeded++
            continue
        }

        try {
            await docClient.send(
                new PutCommand({ TableName: SPELLS_TABLE, Item: item }),
            )
            console.log(`  ✅ ${name}`)
            seeded++
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ ${name}: ${msg}`)
            failed++
        }
    }

    console.log(
        `\n✨ Done — ${seeded} seeded, ${skipped} skipped, ${failed} failed.`,
    )
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
