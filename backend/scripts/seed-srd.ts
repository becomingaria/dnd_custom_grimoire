/**
 * seed-srd.ts — Transforms and seeds the SRD 5.1 spells into DynamoDB.
 *
 * Usage:
 *   npm run seed:srd
 *
 * Environment variables (or .env file):
 *   SPELLS_TABLE  — DynamoDB table name (default: grimoire-spells)
 *   AWS_REGION    — AWS region          (default: us-east-1)
 *
 * Source file: seed/srd-spells.json
 * All seeded spells get:
 *   isHomebrew: false  |  source: "SRD 5.1"  |  createdBy: "system"
 * Existing spells (same spellId) are skipped — safe to re-run.
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { v4 as uuidv4 } from "uuid"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

// ─── SRD source types ────────────────────────────────────────────────────────

interface SrdComponents {
    verbal: boolean
    somatic: boolean
    material: boolean
    materials_needed?: string[]
    raw: string
}

interface SrdSpell {
    name: string
    level: string // "cantrip" | "1" | "2" … "9"
    school: string // lowercase e.g. "abjuration"
    casting_time: string
    range: string
    components: SrdComponents
    duration: string
    ritual: boolean
    description: string
    higher_levels?: string
    classes: string[]
    tags?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function toTitleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function parseLevel(raw: string): number {
    return raw === "cantrip" ? 0 : parseInt(raw, 10)
}

function parseComponents(c: SrdComponents): {
    components: string[]
    materialComponents: string | null
} {
    const components: string[] = []
    if (c.verbal) components.push("V")
    if (c.somatic) components.push("S")
    if (c.material) components.push("M")
    const materialComponents = c.materials_needed?.join(", ") ?? null
    return { components, materialComponents }
}

function parseConcentration(duration: string): boolean {
    return duration.toLowerCase().startsWith("concentration")
}

// ─── Transform ───────────────────────────────────────────────────────────────

function transform(srd: SrdSpell, now: string) {
    const { components, materialComponents } = parseComponents(srd.components)
    return {
        spellId: uuidv4(),
        name: srd.name,
        level: parseLevel(srd.level),
        school: capitalize(srd.school),
        castingTime: srd.casting_time,
        range: srd.range,
        components,
        materialComponents,
        duration: srd.duration,
        concentration: parseConcentration(srd.duration),
        ritual: srd.ritual,
        description: srd.description,
        higherLevels: srd.higher_levels ?? null,
        classes: srd.classes.map(toTitleCase),
        isHomebrew: false,
        source: "SRD 5.1",
        tags: srd.tags ?? [],
        damageType: null,
        addedBy: "system",
        createdBy: "system",
        changelog: [],
        createdAt: now,
        updatedAt: now,
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log("📖 SRD Spell Seed")
    console.log(`   Table:  ${SPELLS_TABLE}`)
    console.log(`   Region: ${REGION}\n`)

    const srdPath = path.join(__dirname, "../seed/srd-spells.json")
    const raw = JSON.parse(fs.readFileSync(srdPath, "utf-8")) as SrdSpell[]
    const now = new Date().toISOString()

    const spells = raw.map((s) => transform(s, now))
    console.log(`🔢 ${spells.length} spells to seed\n`)

    let seeded = 0
    let skipped = 0
    let failed = 0

    for (const spell of spells) {
        try {
            await docClient.send(
                new PutCommand({
                    TableName: SPELLS_TABLE,
                    Item: spell,
                    // Only write if this exact spellId doesn't exist yet (idempotent)
                    ConditionExpression: "attribute_not_exists(spellId)",
                }),
            )
            console.log(`  ✅ ${spell.name}`)
            seeded++
        } catch (err: unknown) {
            if (
                err instanceof Error &&
                err.name === "ConditionalCheckFailedException"
            ) {
                console.log(`  ⏭️  Skipped (exists): ${spell.name}`)
                skipped++
            } else {
                console.error(`  ❌ Failed: ${spell.name}`, err)
                failed++
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
