import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { ScanCommand } from "@aws-sdk/lib-dynamodb"
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

        let spells: Record<string, unknown>[]

        const result = await docClient.send(
            new ScanCommand({ TableName: SPELLS_TABLE }),
        )
        spells = (result.Items ?? []) as Record<string, unknown>[]

        // All spells are visible to all authenticated users

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
