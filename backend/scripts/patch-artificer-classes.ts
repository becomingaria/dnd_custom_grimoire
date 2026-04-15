/**
 * Patch script — adds "Artificer" to the `classes` array of every DynamoDB
 * spell whose name appears in seed/artificer.json.
 *
 * Usage:
 *   AWS_PROFILE=personal npm run patch:artificer
 *
 * Supports --dry-run flag to preview changes without writing.
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
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

interface ArtificerEntry {
    name: string
}

interface SpellRecord {
    spellId: string
    name: string
    classes?: string[]
    [key: string]: unknown
}

async function scanAll(): Promise<SpellRecord[]> {
    const items: SpellRecord[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
        const result = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                ExclusiveStartKey: lastKey,
            }),
        )
        items.push(...((result.Items ?? []) as SpellRecord[]))
        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    return items
}

async function main() {
    console.log(
        `\n🔧 Patch: Add Artificer to spell classes${DRY_RUN ? " [DRY RUN]" : ""}`,
    )
    console.log(`   Table:  ${SPELLS_TABLE}`)
    console.log(`   Region: ${REGION}\n`)

    const artificerPath = path.join(__dirname, "../seed/artificer.json")
    const artificerList: ArtificerEntry[] = JSON.parse(
        fs.readFileSync(artificerPath, "utf-8"),
    )
    const artificerNames = new Set(
        artificerList.map((e) => e.name.toLowerCase().trim()),
    )
    console.log(`📋 Artificer spell list: ${artificerNames.size} entries`)

    console.log("🔍 Scanning DynamoDB for all spells…")
    const allSpells = await scanAll()
    console.log(`   Total spells in table: ${allSpells.length}\n`)

    let patched = 0
    let skipped = 0
    let notFound = 0

    for (const spell of allSpells) {
        const nameKey = spell.name?.toLowerCase().trim()
        if (!artificerNames.has(nameKey)) {
            notFound++
            continue
        }

        const currentClasses: string[] = spell.classes ?? []
        if (currentClasses.some((c) => c.toLowerCase() === "artificer")) {
            console.log(`  ⏭️  Already has Artificer: ${spell.name}`)
            skipped++
            continue
        }

        const updatedClasses = [...currentClasses, "Artificer"]

        if (DRY_RUN) {
            console.log(
                `  [dry-run] Would patch: ${spell.name} → classes: [${updatedClasses.join(", ")}]`,
            )
        } else {
            await docClient.send(
                new UpdateCommand({
                    TableName: SPELLS_TABLE,
                    Key: { spellId: spell.spellId },
                    UpdateExpression:
                        "SET #classes = :classes, #updatedAt = :updatedAt",
                    ExpressionAttributeNames: {
                        "#classes": "classes",
                        "#updatedAt": "updatedAt",
                    },
                    ExpressionAttributeValues: {
                        ":classes": updatedClasses,
                        ":updatedAt": new Date().toISOString(),
                    },
                }),
            )
            console.log(
                `  ✅ Patched: ${spell.name} (${spell.spellId}) → +Artificer`,
            )
        }
        patched++
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Patched:       ${patched}`)
    console.log(`   Already had:   ${skipped}`)
    console.log(
        `   Not in list:   ${notFound} (spells that aren't on the Artificer list)`,
    )

    if (DRY_RUN) {
        console.log(
            "\n[dry-run] No changes were written. Remove --dry-run to apply.",
        )
    } else {
        console.log("\n✨ Done!")
    }
}

main().catch((err) => {
    console.error("Patch failed:", err)
    process.exit(1)
})
