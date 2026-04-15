/**
 * seed-canonical.ts
 *
 * Re-seeds the spells table from seed/spells.json — the canonical export
 * produced by `npm run export:spells`. Each spell is written with PutItem
 * (upsert), so running this multiple times is safe.
 *
 * Usage:
 *   npm run seed:canonical          # live run
 *   npm run seed:canonical:dry      # dry run (prints names, writes nothing)
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
const IN_FILE = path.join(__dirname, "..", "seed", "spells.json")

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
})

async function main() {
    if (!fs.existsSync(IN_FILE)) {
        console.error(`seed/spells.json not found — run "npm run export:spells" first.`)
        process.exit(1)
    }

    const spells = JSON.parse(fs.readFileSync(IN_FILE, "utf-8")) as Record<
        string,
        unknown
    >[]

    console.log(
        `\n📥 Seeding ${spells.length} spells from seed/spells.json…${DRY_RUN ? "  [DRY RUN]" : ""}`,
    )

    let seeded = 0
    let failed = 0

    for (const spell of spells) {
        const name = String(spell.name ?? "")
        if (DRY_RUN) {
            console.log(`  [dry] ${name}  (${spell.source})`)
            seeded++
            continue
        }
        try {
            await docClient.send(
                new PutCommand({ TableName: SPELLS_TABLE, Item: spell }),
            )
            console.log(`  ✅ ${name}`)
            seeded++
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ ${name}: ${msg}`)
            failed++
        }
    }

    console.log(`\n─────────────────────────────────`)
    if (DRY_RUN) {
        console.log(`Would seed: ${seeded}`)
    } else {
        console.log(`Seeded: ${seeded}  |  Failed: ${failed}`)
    }
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
