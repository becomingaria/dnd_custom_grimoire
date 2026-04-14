import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, SPELLS_TABLE } from "../shared/dynamodb-client"
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    forbiddenResponse,
    validationErrorResponse,
} from "../shared/response"

const UPDATABLE_FIELDS = [
    "name",
    "level",
    "school",
    "castingTime",
    "range",
    "components",
    "materialComponents",
    "duration",
    "concentration",
    "ritual",
    "description",
    "higherLevels",
    "classes",
    "source",
    "tags",
    "damageType",
]

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims[
            "sub"
        ] as string
        const updatedBy =
            (event.requestContext.authorizer.jwt.claims["email"] as
                | string
                | undefined) ?? userId
        const spellId = event.pathParameters?.spellId

        if (!spellId) return errorResponse("Spell ID is required", 400)
        if (!event.body)
            return validationErrorResponse("Request body is required")

        const existing = await docClient.send(
            new GetCommand({ TableName: SPELLS_TABLE, Key: { spellId } }),
        )

        if (!existing.Item) return notFoundResponse("Spell")
        if (existing.Item.createdBy !== userId) return forbiddenResponse()

        const updates = JSON.parse(event.body)
        const now = new Date().toISOString()

        const changelogEntry = { updatedBy, updatedAt: now }

        const setParts: string[] = [
            "#updatedAt = :updatedAt",
            "#changelog = list_append(if_not_exists(#changelog, :emptyList), :newEntry)",
        ]
        const names: Record<string, string> = {
            "#updatedAt": "updatedAt",
            "#changelog": "changelog",
        }
        const values: Record<string, unknown> = {
            ":updatedAt": now,
            ":emptyList": [],
            ":newEntry": [changelogEntry],
        }

        for (const field of UPDATABLE_FIELDS) {
            if (field in updates) {
                setParts.push(`#${field} = :${field}`)
                names[`#${field}`] = field
                values[`:${field}`] = updates[field]
            }
        }

        const result = await docClient.send(
            new UpdateCommand({
                TableName: SPELLS_TABLE,
                Key: { spellId },
                UpdateExpression: `SET ${setParts.join(", ")}`,
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values,
                ReturnValues: "ALL_NEW",
            }),
        )

        return successResponse(result.Attributes)
    } catch (error) {
        console.error("Error updating spell:", error)
        return errorResponse("Failed to update spell")
    }
}
