import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, SPELLS_TABLE } from "../shared/dynamodb-client"
import { successResponse, errorResponse } from "../shared/response"

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims[
            "sub"
        ] as string
        const q = event.queryStringParameters ?? {}

        // Pagination is only applied when there are no content-filter params,
        // because those filters are applied in-memory after the scan.
        const hasContentFilters = !!(
            q.source ||
            q.school ||
            q.level !== undefined ||
            q.homebrew !== undefined ||
            q.class
        )
        const limitNum = q.limit ? parseInt(q.limit, 10) : undefined

        let spells: Record<string, unknown>[]
        let lastKey: string | undefined

        if (q.source) {
            // Use bySource GSI for efficient source-keyed lookup
            const result = await docClient.send(
                new QueryCommand({
                    TableName: SPELLS_TABLE,
                    IndexName: "bySource",
                    KeyConditionExpression: "#src = :source",
                    ExpressionAttributeNames: { "#src": "source" },
                    ExpressionAttributeValues: { ":source": q.source },
                }),
            )
            spells = (result.Items ?? []) as Record<string, unknown>[]
        } else if (!hasContentFilters && q.startKey) {
            // Second page: fetch ALL remaining items from the given cursor
            let exclusiveKey: Record<string, unknown> | undefined = JSON.parse(
                Buffer.from(q.startKey, "base64url").toString("utf-8"),
            )
            const accumulated: Record<string, unknown>[] = []
            do {
                const r = await docClient.send(
                    new ScanCommand({
                        TableName: SPELLS_TABLE,
                        ExclusiveStartKey: exclusiveKey,
                    }),
                )
                accumulated.push(
                    ...((r.Items ?? []) as Record<string, unknown>[]),
                )
                exclusiveKey = r.LastEvaluatedKey as
                    | Record<string, unknown>
                    | undefined
            } while (exclusiveKey)
            spells = accumulated
            // lastKey intentionally undefined — client now has everything
        } else if (!hasContentFilters && limitNum) {
            // First page: return at most `limitNum` items and a cursor for the rest
            const r = await docClient.send(
                new ScanCommand({
                    TableName: SPELLS_TABLE,
                    Limit: limitNum,
                }),
            )
            spells = (r.Items ?? []) as Record<string, unknown>[]
            if (r.LastEvaluatedKey) {
                lastKey = Buffer.from(
                    JSON.stringify(r.LastEvaluatedKey),
                ).toString("base64url")
            }
        } else {
            const result = await docClient.send(
                new ScanCommand({ TableName: SPELLS_TABLE }),
            )
            spells = (result.Items ?? []) as Record<string, unknown>[]
        }

        // All spells are visible to all authenticated users

        // Optional query-param filters
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

        return successResponse({ spells, count: spells.length, lastKey })
    } catch (error) {
        console.error("Error listing spells:", error)
        return errorResponse("Failed to list spells")
    }
}
