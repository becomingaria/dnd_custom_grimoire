/**
 * migrate-sanity-to-conviction.ts
 *
 * One-shot migration: renames the `totalSanity` attribute on existing
 * characters to `totalConviction` (the app renamed the stat). Old attribute
 * is removed after copying.
 *
 * Usage:
 *   npm run migrate:conviction        # live run
 *   npm run migrate:conviction:dry    # dry run (prints changes, writes nothing)
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

const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE ?? "grimoire-characters"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

async function main() {
    console.log(
        `\n🔄 Scanning ${CHARACTERS_TABLE}…${DRY_RUN ? "  [DRY RUN]" : ""}`,
    )

    const toUpdate: { characterId: string; name: string; value: number }[] =
        []

    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new ScanCommand({
                TableName: CHARACTERS_TABLE,
                ProjectionExpression: "characterId, #n, totalSanity",
                ExpressionAttributeNames: { "#n": "name" },
                ExclusiveStartKey: lastKey,
            }),
        )
        for (const item of r.Items ?? []) {
            if (typeof item.totalSanity === "number") {
                toUpdate.push({
                    characterId: item.characterId as string,
                    name: item.name as string,
                    value: item.totalSanity,
                })
            }
        }
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    console.log(`   Characters with totalSanity set: ${toUpdate.length}`)

    if (toUpdate.length === 0) {
        console.log("   Nothing to do.")
        return
    }

    for (const { name, value } of toUpdate) {
        console.log(`   ${name}: totalSanity=${value} → totalConviction=${value}`)
    }

    if (DRY_RUN) {
        console.log(`\n   Would update: ${toUpdate.length} characters`)
        return
    }

    console.log(`\n   Updating…`)
    let updated = 0
    let failed = 0

    for (const { characterId, value } of toUpdate) {
        try {
            await docClient.send(
                new UpdateCommand({
                    TableName: CHARACTERS_TABLE,
                    Key: { characterId },
                    UpdateExpression:
                        "SET totalConviction = :value, updatedAt = :now REMOVE totalSanity",
                    ExpressionAttributeValues: {
                        ":value": value,
                        ":now": new Date().toISOString(),
                    },
                }),
            )
            updated++
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ ${characterId}: ${msg}`)
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
