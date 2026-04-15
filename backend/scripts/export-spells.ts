/**
 * export-spells.ts
 *
 * Scans DynamoDB and writes all non-homebrew spells to seed/spells.json,
 * sorted by level then name. The output file can be used to re-seed the
 * table from scratch with the companion seed:canonical script.
 *
 * Usage:
 *   npm run export:spells
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"
const OUT_FILE = path.join(__dirname, "..", "seed", "spells.json")

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client)

async function main() {
    console.log(`\n📤 Exporting non-homebrew spells from ${SPELLS_TABLE}…`)

    const all: Record<string, unknown>[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
        const r = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                ExclusiveStartKey: lastKey,
            }),
        )
        all.push(...((r.Items ?? []) as Record<string, unknown>[]))
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    const canonical = all
        .filter((s) => !s.isHomebrew)
        .sort((a, b) => {
            if (a.level !== b.level)
                return (a.level as number) - (b.level as number)
            return String(a.name).localeCompare(String(b.name))
        })

    fs.writeFileSync(OUT_FILE, JSON.stringify(canonical, null, 2), "utf-8")

    console.log(`   Total in table : ${all.length}`)
    console.log(
        `   Homebrew        : ${all.length - canonical.length}  (excluded)`,
    )
    console.log(`   Exported        : ${canonical.length}`)
    console.log(`\n✅ Written to ${path.relative(process.cwd(), OUT_FILE)}`)
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
