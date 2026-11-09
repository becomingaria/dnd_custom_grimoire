import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { ScanCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, SPELLS_TABLE } from "../shared/dynamodb-client"
import { successResponse, errorResponse } from "../shared/response"
import { getCaller } from "../shared/auth"
import { canView, isShared, spellbookSpellIds } from "../shared/visibility"

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const caller = getCaller(event)
        const q = event.queryStringParameters ?? {}

        // A single Scan returns at most 1 MB — page through the whole table.
        let spells: Record<string, unknown>[] = []
        let lastKey: Record<string, unknown> | undefined
        do {
            const result = await docClient.send(
                new ScanCommand({
                    TableName: SPELLS_TABLE,
                    ExclusiveStartKey: lastKey,
                }),
            )
            spells.push(...((result.Items ?? []) as Record<string, unknown>[]))
            lastKey = result.LastEvaluatedKey
        } while (lastKey)

        // Hide other members' private homebrew (see shared/visibility.ts).
        // Only look up the caller's spellbooks if something is actually hidden.
        const hasForeignPrivate = spells.some(
            (s) =>
                s.isHomebrew &&
                !isShared(s) &&
                s.createdBy !== caller.userId,
        )
        if (hasForeignPrivate && !caller.isAdmin) {
            const spellbook = await spellbookSpellIds(caller.userId)
            spells = spells.filter((s) => canView(s, caller, spellbook))
        }

        // Optional query-param filters
        if (q.source) {
            spells = spells.filter((s) => {
                const sources = Array.isArray(s.sources)
                    ? (s.sources as string[])
                    : typeof s.source === "string"
                      ? [s.source as string]
                      : []
                return sources.some(
                    (src) => src.toLowerCase() === q.source!.toLowerCase(),
                )
            })
        }
        if (q.school) {
            spells = spells.filter(
                (s) =>
                    (s.school as string).toLowerCase() ===
                    q.school!.toLowerCase(),
            )
        }
        if (q.level !== undefined) {
            spells = spells.filter((s) => s.level === Number(q.level))
        }
        if (q.homebrew !== undefined) {
            spells = spells.filter(
                (s) => s.isHomebrew === (q.homebrew === "true"),
            )
        }
        if (q.class) {
            spells = spells.filter(
                (s) =>
                    Array.isArray(s.classes) &&
                    (s.classes as string[]).some(
                        (c) => c.toLowerCase() === q.class!.toLowerCase(),
                    ),
            )
        }

        // Sort: by level asc, then alphabetically
        spells.sort((a, b) => {
            if (a.level !== b.level)
                return (a.level as number) - (b.level as number)
            return String(a.name).localeCompare(String(b.name))
        })

        return successResponse({ spells, count: spells.length })
    } catch (error) {
        console.error("Error listing spells:", error)
        return errorResponse("Failed to list spells")
    }
}
