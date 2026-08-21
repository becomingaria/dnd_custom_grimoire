/**
 * patch-add-sources-field.ts
 *
 * One-shot patch: for every spell whose spellId starts with a given prefix,
 * sets `sources = [sourceLabel]` if the field is missing or empty.
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/patch-add-sources-field.ts <idPrefix> <sourceLabel> [--dry-run]
 *
 * Example:
 *   AWS_PROFILE=personal ts-node --project tsconfig.json scripts/patch-add-sources-field.ts itwaw- ItWaW
 *   AWS_PROFILE=personal ts-node --project tsconfig.json scripts/patch-add-sources-field.ts itwaw- ItWaW --dry-run
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

const [, , idPrefixArg, sourceLabelArg] = process.argv
const DRY_RUN = process.argv.includes("--dry-run")

if (!idPrefixArg || !sourceLabelArg) {
    console.error(
        "Usage: ts-node patch-add-sources-field.ts <idPrefix> <sourceLabel> [--dry-run]",
    )
    process.exit(1)
}

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

async function main() {
    console.log(
        `\n🔧 Patching sources field for prefix "${idPrefixArg}" → ["${sourceLabelArg}"]${DRY_RUN ? " [DRY RUN]" : ""}`,
    )
    console.log(`   Table: ${SPELLS_TABLE}\n`)

    // Scan for all spells with matching spellId prefix
    let lastKey: Record<string, unknown> | undefined
    const matches: { spellId: string; name: string }[] = []

    do {
        const result = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                FilterExpression: "begins_with(spellId, :prefix)",
                ExpressionAttributeValues: { ":prefix": idPrefixArg },
                ProjectionExpression: "spellId, #n, sources",
                ExpressionAttributeNames: { "#n": "name" },
                ExclusiveStartKey: lastKey,
            }),
        )
        for (const item of result.Items ?? []) {
            matches.push(item as { spellId: string; name: string })
        }
        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    console.log(`Found ${matches.length} matching spells.\n`)

    let patched = 0
    let skipped = 0

    for (const item of matches) {
        const existing = (item as Record<string, unknown>).sources as
            | string[]
            | undefined
        if (existing && existing.length > 0) {
            console.log(`  ⏭️  Skip (already has sources): ${item.name}`)
            skipped++
            continue
        }

        if (DRY_RUN) {
            console.log(
                `  [dry-run] Would patch: ${item.name} (${item.spellId})`,
            )
            patched++
            continue
        }

        await docClient.send(
            new UpdateCommand({
                TableName: SPELLS_TABLE,
                Key: { spellId: item.spellId },
                UpdateExpression: "SET sources = :sources, updatedAt = :now",
                ExpressionAttributeValues: {
                    ":sources": [sourceLabelArg],
                    ":now": new Date().toISOString(),
                },
            }),
        )
        console.log(`  ✅ Patched: ${item.name}`)
        patched++
    }

    console.log(`\n📊 Summary: ${patched} patched, ${skipped} skipped`)
    if (DRY_RUN) console.log("   [dry-run] No changes written.")
}

main().catch((err) => {
    console.error("Patch failed:", err)
    process.exit(1)
})
