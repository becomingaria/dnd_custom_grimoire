/**
 * seed-improved-initiative.ts
 *
 * Imports Improved Initiative export JSON into the spells table.
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/seed-improved-initiative.ts <inputFile> <sourceLabel> [--dry-run]
 *
 * Example:
 *   npm run seed:xgte
 *   npm run seed:tcoe
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

interface IiSpellRaw {
    Id?: string
    Name?: string
    Source?: string
    CastingTime?: string
    Classes?: string[]
    Components?: string
    Description?: string
    Duration?: string
    Level?: string | number
    Range?: string
    Ritual?: boolean
    School?: string
}

function toTitleCase(word: string): string {
    if (!word) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function normalizeSchool(raw: string | undefined): string {
    return toTitleCase((raw ?? "Evocation").trim())
}

function normalizeLevel(raw: string | number | undefined): number {
    if (typeof raw === "number") return raw
    if (!raw) return 0
    const parsed = parseInt(String(raw).trim(), 10)
    return Number.isFinite(parsed) ? parsed : 0
}

function parseComponents(raw: string | undefined): {
    components: string[]
    materialComponents: string | null
} {
    if (!raw) return { components: [], materialComponents: null }

    const found = raw.match(/\b[VSM]\b/g) ?? []
    const components = [...new Set(found)]
    const materialMatch = raw.match(/\(([^)]+)\)/)
    const materialComponents = materialMatch?.[1]?.trim() ?? null

    return { components, materialComponents }
}

function normalizeDescription(raw: string | undefined): {
    description: string
    higherLevels: string | null
} {
    const text = (raw ?? "").replace(/\r\n/g, "\n").trim()
    const patterns = [/\*\*At Higher Levels\.?\*\*/i, /At Higher Levels\.?/i]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (!match || match.index == null) continue
        const i = match.index
        const before = text.slice(0, i).trim()
        const after = text
            .slice(i + match[0].length)
            .replace(/^[\s:.-]+/, "")
            .trim()
        return {
            description: before || text,
            higherLevels: after || null,
        }
    }

    return { description: text, higherLevels: null }
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

function normalizeClasses(raw: string[] | undefined): string[] {
    if (!raw || !Array.isArray(raw)) return []
    return [...new Set(raw.map((c) => c.trim()).filter(Boolean))]
}

function isConcentration(duration: string): boolean {
    return duration.toLowerCase().startsWith("concentration")
}

function extractSpellRecords(payload: Record<string, unknown>): IiSpellRaw[] {
    const idsRaw = payload["ImprovedInitiative.Spells"]
    const ids: string[] =
        typeof idsRaw === "string"
            ? (JSON.parse(idsRaw) as string[])
            : Array.isArray(idsRaw)
              ? (idsRaw as string[])
              : []

    if (ids.length > 0) {
        return ids
            .map((id) => payload[`ImprovedInitiative.Spells.${id}`])
            .map((raw) => {
                if (typeof raw === "string") return JSON.parse(raw)
                return raw
            })
            .filter((v): v is IiSpellRaw => !!v && typeof v === "object")
    }

    const fromImprovedInitiative = Object.entries(payload)
        .filter(([key]) => key.startsWith("ImprovedInitiative.Spells."))
        .map(([, value]) => {
            if (typeof value === "string") return JSON.parse(value)
            return value
        })
        .filter((v): v is IiSpellRaw => !!v && typeof v === "object")

    if (fromImprovedInitiative.length > 0) return fromImprovedInitiative

    // TCoE export shape can be flat keys like "Spells.<id>" with object payloads.
    return Object.entries(payload)
        .filter(([key]) => key.startsWith("Spells."))
        .map(([, value]) => {
            if (typeof value === "string") return JSON.parse(value)
            return value
        })
        .filter((v): v is IiSpellRaw => !!v && typeof v === "object")
}

function transformSpell(
    raw: IiSpellRaw,
    sourceLabel: string,
    now: string,
): Record<string, unknown> | null {
    const name = raw.Name?.trim()
    if (!name) return null

    const sourceId = slugify(sourceLabel)
    const iiId = (raw.Id ?? "").trim()
    const spellId = iiId
        ? `${sourceId}-${slugify(name)}-${iiId}`
        : `${sourceId}-${slugify(name)}`

    const duration = (raw.Duration ?? "").trim() || "Instantaneous"
    const { components, materialComponents } = parseComponents(raw.Components)
    const { description, higherLevels } = normalizeDescription(raw.Description)

    return {
        spellId,
        name,
        level: normalizeLevel(raw.Level),
        school: normalizeSchool(raw.School),
        castingTime: (raw.CastingTime ?? "1 action").trim(),
        range: (raw.Range ?? "Self").trim(),
        components,
        materialComponents,
        duration,
        concentration: isConcentration(duration),
        ritual: !!raw.Ritual,
        description,
        higherLevels,
        classes: normalizeClasses(raw.Classes),
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
}

async function main() {
    const [, , inputFileArg, sourceLabelArg, maybeDryRun] = process.argv
    if (!inputFileArg || !sourceLabelArg) {
        console.error(
            "Usage: ts-node --project tsconfig.json scripts/seed-improved-initiative.ts <inputFile> <sourceLabel> [--dry-run]",
        )
        process.exit(1)
    }

    const dryRun = maybeDryRun === "--dry-run"
    const inputFile = path.isAbsolute(inputFileArg)
        ? inputFileArg
        : path.join(__dirname, "..", inputFileArg)
    const sourceLabel = sourceLabelArg.trim()

    const rawPayload = JSON.parse(
        fs.readFileSync(inputFile, "utf-8"),
    ) as Record<string, unknown>
    const rawSpells = extractSpellRecords(rawPayload)
    const now = new Date().toISOString()

    const transformed = rawSpells
        .map((spell) => transformSpell(spell, sourceLabel, now))
        .filter((s): s is Record<string, unknown> => !!s)

    console.log("📚 Improved Initiative Seed")
    console.log(`   Input:   ${inputFile}`)
    console.log(`   Source:  ${sourceLabel}`)
    console.log(`   Table:   ${SPELLS_TABLE}`)
    console.log(`   Region:  ${REGION}`)
    console.log(`   Spells:  ${transformed.length}`)
    if (dryRun) {
        console.log("\n🧪 Dry run only — no writes performed.")
        return
    }

    let seeded = 0
    let skipped = 0
    let failed = 0

    for (const spell of transformed) {
        try {
            await docClient.send(
                new PutCommand({
                    TableName: SPELLS_TABLE,
                    Item: spell,
                    ConditionExpression: "attribute_not_exists(spellId)",
                }),
            )
            seeded++
        } catch (err: unknown) {
            if (
                err instanceof Error &&
                err.name === "ConditionalCheckFailedException"
            ) {
                skipped++
            } else {
                failed++
                console.error("❌ Failed to seed spell:", spell.name, err)
            }
        }
    }

    console.log(
        `\n✨ Done — ${seeded} seeded, ${skipped} skipped, ${failed} failed`,
    )
}

main().catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
})
