/**
 * merge-duplicate-spells.ts
 *
 * Scans DynamoDB and consolidates spells that share the same name into a
 * single item with a `sources: string[]` array instead of a single `source`
 * string.  All single-source spells are also migrated from `source: "X"` to
 * `sources: ["X"]` (the old `source` attribute is removed).
 *
 * Merge strategy
 * ──────────────
 * • Group all items by name (case-insensitive, trimmed).
 * • Pick a "winner" for each group: the item with the most classes; ties
 *   broken by preferring non-SRD sources, then alphabetically by source.
 * • The winner keeps its spellId and all its fields.
 * • `sources` is set to the sorted union of every source value in the group.
 * • `classes` is set to the sorted union of every classes array in the group.
 * • The old `source` attribute is removed from every written item.
 * • All loser items are deleted.
 *
 * Usage
 * ─────
 *   npm run merge:dupes          # dry run — prints planned changes, no writes
 *   npm run merge:dupes:live     # applies changes to DynamoDB
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb"

dotenv.config({ path: path.join(__dirname, "../.env") })

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"
const DRY_RUN = !process.argv.includes("--live")

const client = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(client)

type SpellItem = Record<string, unknown>

/** Returns all source values for an item, whether stored as string or array. */
function getSourceValues(item: SpellItem): string[] {
    if (Array.isArray(item.sources)) return item.sources as string[]
    if (typeof item.source === "string" && item.source) return [item.source]
    return []
}

async function main() {
    console.log(
        `\n${DRY_RUN ? "🔍 DRY RUN — no writes" : "⚡ LIVE — writing to DynamoDB"}\n`,
    )
    console.log(`Scanning ${SPELLS_TABLE}…`)

    // ── 1. Fetch all items ────────────────────────────────────────────────────
    const all: SpellItem[] = []
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                ExclusiveStartKey: lastKey,
            }),
        )
        all.push(...((r.Items ?? []) as SpellItem[]))
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    console.log(`   ${all.length} items found\n`)

    // ── 2. Group by normalised name ───────────────────────────────────────────
    const byName = new Map<string, SpellItem[]>()
    for (const item of all) {
        const key = String(item.name ?? "")
            .toLowerCase()
            .trim()
        if (!byName.has(key)) byName.set(key, [])
        byName.get(key)!.push(item)
    }

    let mergedGroups = 0
    let singleMigrations = 0
    let deletions = 0
    let errors = 0

    // ── 3. Process each group ─────────────────────────────────────────────────
    for (const [, group] of byName) {
        const isDuplicate = group.length > 1

        if (!isDuplicate) {
            // Single item — just convert source → sources if needed
            const item = group[0]
            if (typeof item.source === "string") {
                const updated: SpellItem = {
                    ...item,
                    sources: [item.source],
                    updatedAt: new Date().toISOString(),
                }
                delete updated.source

                if (DRY_RUN) {
                    console.log(
                        `  migrate  "${item.name}"  source:"${item.source}" → sources:["${item.source}"]`,
                    )
                } else {
                    try {
                        await docClient.send(
                            new PutCommand({
                                TableName: SPELLS_TABLE,
                                Item: updated,
                            }),
                        )
                    } catch (e) {
                        console.error(
                            `  ✗ Failed to migrate "${item.name}":`,
                            e,
                        )
                        errors++
                        continue
                    }
                }
                singleMigrations++
            }
            continue
        }

        // ── Duplicate group ───────────────────────────────────────────────────
        // Collect merged sources + classes
        const allSources = Array.from(
            new Set(group.flatMap(getSourceValues)),
        ).sort()
        const allClasses = Array.from(
            new Set(
                group.flatMap((i) =>
                    Array.isArray(i.classes) ? (i.classes as string[]) : [],
                ),
            ),
        ).sort()

        // Pick winner: most classes, then prefer non-SRD, then alphabetical source
        const winner = [...group].sort((a, b) => {
            const aClasses = Array.isArray(a.classes) ? a.classes.length : 0
            const bClasses = Array.isArray(b.classes) ? b.classes.length : 0
            if (bClasses !== aClasses) return bClasses - aClasses
            const aSrc = getSourceValues(a)[0] ?? ""
            const bSrc = getSourceValues(b)[0] ?? ""
            const aSRD = aSrc === "SRD 5.1" ? 1 : 0
            const bSRD = bSrc === "SRD 5.1" ? 1 : 0
            if (aSRD !== bSRD) return aSRD - bSRD // non-SRD wins
            return aSrc.localeCompare(bSrc)
        })[0]

        const losers = group.filter((i) => i.spellId !== winner.spellId)

        const mergedItem: SpellItem = {
            ...winner,
            sources: allSources,
            classes: allClasses,
            updatedAt: new Date().toISOString(),
        }
        delete mergedItem.source // remove old single-source field

        if (DRY_RUN) {
            const loserSources = losers.map((l) => getSourceValues(l)[0] ?? "?")
            console.log(
                `  merge    "${winner.name}"  [${allSources.join(", ")}]  classes:${allClasses.length}  (removes ${losers.length}: spellIds ${losers.map((l) => l.spellId).join(", ")})`,
            )
            if (loserSources.length)
                console.log(`           losers: ${loserSources.join(", ")}`)
        } else {
            try {
                await docClient.send(
                    new PutCommand({
                        TableName: SPELLS_TABLE,
                        Item: mergedItem,
                    }),
                )
                for (const loser of losers) {
                    await docClient.send(
                        new DeleteCommand({
                            TableName: SPELLS_TABLE,
                            Key: { spellId: loser.spellId },
                        }),
                    )
                    deletions++
                }
            } catch (e) {
                console.error(`  ✗ Failed to merge "${winner.name}":`, e)
                errors++
                continue
            }
        }
        mergedGroups++
    }

    // ── 4. Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(50)}`)
    if (DRY_RUN) {
        console.log(`Planned operations (dry run):`)
        console.log(`  Single-source migrations : ${singleMigrations}`)
        console.log(`  Duplicate groups to merge: ${mergedGroups}`)
        console.log(
            `  Items that would be deleted: ${all.length - (byName.size - mergedGroups) - mergedGroups - singleMigrations + mergedGroups}`,
        )
        console.log(`\nRun with --live to apply changes.`)
    } else {
        console.log(`Results:`)
        console.log(`  Single-source migrated : ${singleMigrations}`)
        console.log(`  Groups merged          : ${mergedGroups}`)
        console.log(`  Duplicates deleted     : ${deletions}`)
        console.log(`  Errors                 : ${errors}`)
        if (errors === 0)
            console.log(
                `\n✅ Done — run npm run export:spells to update seed/spells.json`,
            )
        else
            console.log(
                `\n⚠️  Completed with ${errors} error(s) — review above.`,
            )
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
