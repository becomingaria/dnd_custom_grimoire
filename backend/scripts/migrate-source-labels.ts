/**
 * migrate-source-labels.ts
 *
 * Migrates existing DynamoDB spells to use the correct source abbreviations.
 * Only the `source` attribute is updated — spellIds and all other fields are
 * left untouched so character knownSpellIds / preparedSpellIds stay valid.
 *
 * Usage:
 *   npm run migrate:sources          # live run
 *   npm run migrate:sources:dry      # dry run (prints changes, writes nothing)
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
    DynamoDBDocumentClient,
    ScanCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const DRY_RUN = process.argv.includes("--dry-run")

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

// ─── Source name → abbreviation mapping ───────────────────────────────────────

const SOURCE_RENAMES: Record<string, string> = {
    // Seeded via seed-5etools-filtered (label was "EE")
    EE: "EEPC",
    // Seeded via seed-class-spells (full source name from class JSON files)
    "Acquisitions Inc.": "AI",
    "Explorer's Guide to Wildemount": "EGtW",
    "Fizban's Treasury of Dragons": "FToD",
    "Guildmaster's Guide to Ravnica": "GGtR",
    "Icewind Dale - Rime of the Frostmaiden": "ROtF",
    "Lost Laboratory of Kwalish": "LLoK",
    Strixhaven: "SCoC",
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔄 Scanning ${SPELLS_TABLE}…${DRY_RUN ? "  [DRY RUN]" : ""}`)

    // Full table scan — collect all spells that need renaming
    const toUpdate: {
        spellId: string
        oldSource: string
        newSource: string
    }[] = []

    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                ProjectionExpression: "spellId, #src",
                ExpressionAttributeNames: { "#src": "source" },
                ExclusiveStartKey: lastKey,
            }),
        )
        for (const item of r.Items ?? []) {
            const oldSource = item.source as string
            const newSource = SOURCE_RENAMES[oldSource]
            if (newSource) {
                toUpdate.push({
                    spellId: item.spellId as string,
                    oldSource,
                    newSource,
                })
            }
        }
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    console.log(`   Matching spells: ${toUpdate.length}`)

    if (toUpdate.length === 0) {
        console.log("   Nothing to do.")
        return
    }

    // Group by source for a readable summary
    const bySource: Record<string, number> = {}
    for (const { oldSource, newSource } of toUpdate) {
        const label = `"${oldSource}" → "${newSource}"`
        bySource[label] = (bySource[label] ?? 0) + 1
    }
    for (const [label, count] of Object.entries(bySource)) {
        console.log(`   ${count.toString().padStart(3)}  ${label}`)
    }

    if (DRY_RUN) {
        console.log(`\n   Would update: ${toUpdate.length} spells`)
        return
    }

    console.log(`\n   Updating…`)
    let updated = 0
    let failed = 0

    for (const { spellId, newSource } of toUpdate) {
        try {
            await docClient.send(
                new UpdateCommand({
                    TableName: SPELLS_TABLE,
                    Key: { spellId },
                    UpdateExpression: "SET #src = :newSource, updatedAt = :now",
                    ExpressionAttributeNames: { "#src": "source" },
                    ExpressionAttributeValues: {
                        ":newSource": newSource,
                        ":now": new Date().toISOString(),
                    },
                }),
            )
            updated++
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ ${spellId}: ${msg}`)
            failed++
        }
    }

    console.log(`\n─────────────────────────────────`)
    console.log(`Updated: ${updated}  |  Failed: ${failed}`)
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
