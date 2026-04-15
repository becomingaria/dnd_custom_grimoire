/**
 * seed-custom-sourcebook.ts
 *
 * Seeds a custom sourcebook JSON into the spells table.
 * Expects a JSON file with shape:
 *   { "source": string, "spells": CustomSpell[] }
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/seed-custom-sourcebook.ts <inputFile> <sourceLabel> [--dry-run]
 *
 * Examples:
 *   npm run seed:atow
 *   ts-node ... scripts/seed-custom-sourcebook.ts seed/my-book.json "MyBook" --dry-run
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const [, , inputFileArg, sourceLabelArg] = process.argv
const DRY_RUN = process.argv.includes("--dry-run")

if (!inputFileArg || !sourceLabelArg) {
    console.error(
        "Usage: ts-node seed-custom-sourcebook.ts <inputFile> <sourceLabel> [--dry-run]",
    )
    process.exit(1)
}

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

interface CustomSpell {
    name: string
    level: number
    school: string
    casting_time: string
    range: string
    components: string
    duration: string
    classes: string[]
    description: string
    at_higher_levels?: string
    ritual?: boolean
}

interface CustomSourcebook {
    source?: string
    spells: CustomSpell[]
}

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
    const materialMatch = raw.match(/\(([^)]+)\)/)
    const materialComponents = materialMatch?.[1]?.trim() ?? null
    return { components, materialComponents }
}

function isConcentration(duration: string): boolean {
    return duration.toLowerCase().startsWith("concentration")
}

function normalizeClasses(raw: string[]): string[] {
    return [
        ...new Set(
            raw
                .map((c) => c.trim())
                .filter(Boolean)
                // Fix common typos (e.g. "Wizards" → "Wizard")
                .map((c) => (c.toLowerCase() === "wizards" ? "Wizard" : c)),
        ),
    ]
}

function transformSpell(
    spell: CustomSpell,
    sourceLabel: string,
    now: string,
): Record<string, unknown> {
    const sourceSlug = slugify(sourceLabel)
    const spellId = `${sourceSlug}-${slugify(spell.name)}`
    const { components, materialComponents } = parseComponents(
        spell.components ?? "",
    )

    return {
        spellId,
        name: spell.name.trim(),
        level: spell.level ?? 0,
        school:
            spell.school.charAt(0).toUpperCase() +
            spell.school.slice(1).toLowerCase(),
        castingTime: spell.casting_time?.trim() ?? "1 action",
        range: spell.range?.trim() ?? "Self",
        components,
        materialComponents,
        duration: spell.duration?.trim() ?? "Instantaneous",
        concentration: isConcentration(spell.duration ?? ""),
        ritual: spell.ritual ?? false,
        description: spell.description?.trim() ?? "",
        higherLevels: spell.at_higher_levels?.trim() ?? null,
        classes: normalizeClasses(spell.classes ?? []),
        isHomebrew: false,
        source: sourceLabel,
        tags: [],
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
    }
}

async function main() {
    const inputFile = path.isAbsolute(inputFileArg)
        ? inputFileArg
        : path.join(__dirname, "..", inputFileArg)

    if (!fs.existsSync(inputFile)) {
        console.error(`File not found: ${inputFile}`)
        process.exit(1)
    }

    const now = new Date().toISOString()
    const raw: CustomSourcebook = JSON.parse(
        fs.readFileSync(inputFile, "utf-8"),
    )
    const spells = raw.spells

    console.log(
        `\n📖 Seeding custom sourcebook: ${sourceLabelArg}${DRY_RUN ? " [DRY RUN]" : ""}`,
    )
    console.log(`   File:    ${inputFile}`)
    console.log(`   Table:   ${SPELLS_TABLE}`)
    console.log(`   Spells:  ${spells.length}\n`)

    let seeded = 0
    let skipped = 0
    let failed = 0

    for (const spell of spells) {
        if (!spell.name) continue
        const item = transformSpell(spell, sourceLabelArg, now)

        if (DRY_RUN) {
            console.log(
                `  [dry-run] ${item.name} (${item.spellId}) — Level ${item.level} ${item.school}`,
            )
            seeded++
            continue
        }

        try {
            await docClient.send(
                new PutCommand({
                    TableName: SPELLS_TABLE,
                    Item: item,
                    ConditionExpression: "attribute_not_exists(spellId)",
                }),
            )
            console.log(`  ✅ Seeded: ${item.name} (${item.spellId})`)
            seeded++
        } catch (err: unknown) {
            if (
                err instanceof Error &&
                err.name === "ConditionalCheckFailedException"
            ) {
                console.log(`  ⏭️  Skipped (exists): ${item.name as string}`)
                skipped++
            } else {
                console.error(`  ❌ Failed: ${item.name as string}`, err)
                failed++
            }
        }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Seeded:  ${seeded}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Failed:  ${failed}`)

    if (DRY_RUN) {
        console.log(
            "\n[dry-run] No changes written. Remove --dry-run to apply.",
        )
    } else {
        console.log("\n✨ Done!")
    }
}

main().catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
})
