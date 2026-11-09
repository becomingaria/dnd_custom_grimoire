/**
 * audit-spells.ts
 *
 * Checks every spell against the Grimoire spell standard
 * (shared/spell-standard.ts, documented in docs/SPELL_STANDARD.md) and reports
 * attribution gaps, data corruption and style drift.
 *
 * On top of validateSpell() it also checks things that need the whole corpus:
 *   • "SRD 5.1" is only claimed by spells that are actually in the SRD
 *   • no two spells share a name (case/punctuation-insensitive)
 *   • no two spells share a description (copy-paste corruption)
 *   • legacy `source` (singular) attributes that never became `sources`
 *
 * Usage:
 *   npm run audit:spells                      # audit seed/spells.json
 *   npm run audit:spells -- --file other.json # audit another export
 *   npm run audit:spells:db                   # audit the live table (incl. homebrew)
 *   …add --verbose to list every affected spell, --errors-only to hide warnings
 *
 * Exit code is 1 when any error is found, so it can gate CI or a seed step.
 */

import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"
import {
    validateSpell,
    SRD_SOURCE,
    type SpellIssue,
    type StandardSpell,
} from "../../shared/spell-standard"
import srdData from "./data/srd-5.1-spell-names.json"

dotenv.config({ path: path.join(__dirname, "../.env") })

const args = process.argv.slice(2)
const USE_DB = args.includes("--db")
const VERBOSE = args.includes("--verbose")
const ERRORS_ONLY = args.includes("--errors-only")
const fileArgIdx = args.indexOf("--file")
const FILE =
    fileArgIdx >= 0
        ? path.resolve(args[fileArgIdx + 1])
        : path.join(__dirname, "..", "seed", "spells.json")

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? "grimoire-spells"
const REGION = process.env.AWS_REGION ?? "us-east-1"

type SpellRecord = StandardSpell & {
    spellId: string
    source?: string
    [key: string]: unknown
}

const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "")
const SRD_NAMES = new Set(srdData.names.map(nameKey))

async function loadSpells(): Promise<SpellRecord[]> {
    if (!USE_DB) {
        return JSON.parse(fs.readFileSync(FILE, "utf-8")) as SpellRecord[]
    }
    const docClient = DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: REGION }),
    )
    const all: SpellRecord[] = []
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new ScanCommand({
                TableName: SPELLS_TABLE,
                ExclusiveStartKey: lastKey,
            }),
        )
        all.push(...((r.Items ?? []) as SpellRecord[]))
        lastKey = r.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)
    return all
}

/** Corpus-level checks that validateSpell() cannot see on its own. */
export function corpusIssues(
    spells: SpellRecord[],
): Map<string, SpellIssue[]> {
    const out = new Map<string, SpellIssue[]>()
    const add = (id: string, issue: SpellIssue) =>
        out.set(id, [...(out.get(id) ?? []), issue])

    const byName = new Map<string, SpellRecord[]>()
    const byDesc = new Map<string, SpellRecord[]>()

    for (const s of spells) {
        if (!Array.isArray(s.sources) && typeof s.source === "string") {
            add(s.spellId, {
                field: "sources",
                severity: "error",
                message: `Legacy "source" attribute ("${s.source}") was never migrated to "sources"`,
            })
        }
        if (
            s.sources?.includes(SRD_SOURCE) &&
            !SRD_NAMES.has(nameKey(s.name))
        ) {
            add(s.spellId, {
                field: "sources",
                severity: "error",
                message: `Cites "${SRD_SOURCE}" but this spell is not in the SRD`,
            })
        }

        const nk = nameKey(s.name ?? "")
        byName.set(nk, [...(byName.get(nk) ?? []), s])
        const dk = (s.description ?? "").slice(0, 200).toLowerCase()
        if (dk) byDesc.set(dk, [...(byDesc.get(dk) ?? []), s])
    }

    for (const group of byName.values()) {
        if (group.length < 2) continue
        for (const s of group)
            add(s.spellId, {
                field: "name",
                severity: "error",
                message: `Duplicate name (${group.length} spells) — merge them into one spell with combined sources`,
            })
    }
    for (const group of byDesc.values()) {
        if (group.length < 2) continue
        const names = group.map((g) => g.name).join(" / ")
        for (const s of group)
            add(s.spellId, {
                field: "description",
                severity: "error",
                message: `Shares its description with another spell (${names}) — likely copy-paste corruption`,
            })
    }
    return out
}

async function main() {
    const spells = await loadSpells()
    console.log(
        `\n🔎 Auditing ${spells.length} spells from ${USE_DB ? `table ${SPELLS_TABLE}` : path.relative(process.cwd(), FILE)}\n`,
    )

    const extra = corpusIssues(spells)

    // message-pattern → spell names
    const groups = new Map<
        string,
        { severity: SpellIssue["severity"]; spells: string[] }
    >()
    const perSource = new Map<
        string,
        { total: number; errors: number; warnings: number }
    >()
    let errorCount = 0
    let warningCount = 0

    for (const spell of spells) {
        const issues = [
            ...validateSpell({
                ...spell,
                sources: Array.isArray(spell.sources) ? spell.sources : [],
            }),
            ...(extra.get(spell.spellId) ?? []),
        ]
        const errs = issues.filter((i) => i.severity === "error").length
        const warns = issues.length - errs
        errorCount += errs
        warningCount += warns

        const srcKey = (spell.sources ?? []).join(", ") || "(none)"
        const ps = perSource.get(srcKey) ?? { total: 0, errors: 0, warnings: 0 }
        ps.total++
        ps.errors += errs ? 1 : 0
        ps.warnings += warns ? 1 : 0
        perSource.set(srcKey, ps)

        for (const issue of issues) {
            if (ERRORS_ONLY && issue.severity === "warning") continue
            // Group style warnings by field so the report stays readable
            const key = issue.message.startsWith("Not in house style")
                ? `[${issue.field}] not in house style`
                : `[${issue.field}] ${issue.message}`
            const g = groups.get(key) ?? {
                severity: issue.severity,
                spells: [],
            }
            g.spells.push(spell.name)
            groups.set(key, g)
        }
    }

    console.log("By source")
    console.log("─────────")
    for (const [src, s] of [...perSource.entries()].sort(
        (a, b) => b[1].total - a[1].total,
    )) {
        console.log(
            `  ${src.padEnd(26)} ${String(s.total).padStart(4)} spells   ${s.errors ? `❌ ${s.errors}` : "   "}  ${s.warnings ? `⚠️  ${s.warnings}` : ""}`,
        )
    }

    const sorted = [...groups.entries()].sort((a, b) =>
        a[1].severity === b[1].severity
            ? b[1].spells.length - a[1].spells.length
            : a[1].severity === "error"
              ? -1
              : 1,
    )
    console.log("\nIssues")
    console.log("──────")
    for (const [msg, g] of sorted) {
        const icon = g.severity === "error" ? "❌" : "⚠️ "
        console.log(`${icon} ${msg}  (${g.spells.length})`)
        const shown = VERBOSE ? g.spells : g.spells.slice(0, 8)
        console.log(
            `     ${shown.join(", ")}${g.spells.length > shown.length ? `, … +${g.spells.length - shown.length} more (use --verbose)` : ""}`,
        )
    }

    console.log(
        `\n${errorCount ? "❌" : "✅"} ${errorCount} error(s), ${warningCount} warning(s)\n`,
    )
    if (errorCount) process.exitCode = 1
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err)
        process.exit(1)
    })
}
