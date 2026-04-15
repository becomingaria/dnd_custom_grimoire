import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, CHARACTERS_TABLE } from "../shared/dynamodb-client"
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    forbiddenResponse,
    validationErrorResponse,
} from "../shared/response"

const UPDATABLE_FIELDS = [
    "name",
    "class",
    "subclass",
    "level",
    "knownSpellIds",
    "preparedSpellIds",
    "spellNotes",
    "spellcastingAbility",
    "spellSaveDC",
    "spellAttackBonus",
    "totalKnownSpells",
    "totalSpellsPrepared",
    "totalSanity",
    "notes",
]

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims[
            "sub"
        ] as string
        const characterId = event.pathParameters?.characterId

        if (!characterId) return errorResponse("Character ID is required", 400)
        if (!event.body)
            return validationErrorResponse("Request body is required")

        const existing = await docClient.send(
            new GetCommand({
                TableName: CHARACTERS_TABLE,
                Key: { characterId },
            }),
        )

        if (!existing.Item) return notFoundResponse("Character")
        if (existing.Item.userId !== userId) return forbiddenResponse()

        const updates = JSON.parse(event.body)
        const now = new Date().toISOString()

        const setParts: string[] = ["#updatedAt = :updatedAt"]
        const names: Record<string, string> = { "#updatedAt": "updatedAt" }
        const values: Record<string, unknown> = { ":updatedAt": now }

        for (const field of UPDATABLE_FIELDS) {
            if (field in updates) {
                setParts.push(`#${field} = :${field}`)
                names[`#${field}`] = field
                values[`:${field}`] = updates[field]
            }
        }

        const result = await docClient.send(
            new UpdateCommand({
                TableName: CHARACTERS_TABLE,
                Key: { characterId },
                UpdateExpression: `SET ${setParts.join(", ")}`,
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values,
                ReturnValues: "ALL_NEW",
            }),
        )

        return successResponse(result.Attributes)
    } catch (error) {
        console.error("Error updating character:", error)
        return errorResponse("Failed to update character")
    }
}
