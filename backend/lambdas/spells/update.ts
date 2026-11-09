import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, SPELLS_TABLE } from "../shared/dynamodb-client"
import { getCaller } from "../shared/auth"
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    forbiddenResponse,
    validationErrorResponse,
} from "../shared/response"
import {
    normalizeSpell,
    validateSpell,
    HOMEBREW_SOURCE,
    type StandardSpell,
} from "../../../shared/spell-standard"

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
    "sources",
    "tags",
    "damageType",
] as const

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const caller = getCaller(event)
        const updatedBy = caller.email ?? caller.userId
        const spellId = event.pathParameters?.spellId

        if (!spellId) return errorResponse("Spell ID is required", 400)
        if (!event.body)
            return validationErrorResponse("Request body is required")

        const existing = await docClient.send(
            new GetCommand({ TableName: SPELLS_TABLE, Key: { spellId } }),
        )

        if (!existing.Item) return notFoundResponse("Spell")
        const isOwner = existing.Item.createdBy === caller.userId
        if (!isOwner && !caller.isAdmin) return forbiddenResponse()

        const updates = JSON.parse(event.body) as Record<string, unknown>

        // Build the full post-update spell so the standard is checked on the
        // result, not just the delta. Legacy `source` strings are folded in.
        const current = existing.Item as Record<string, unknown>
        const currentSources = Array.isArray(current.sources)
            ? (current.sources as string[])
            : typeof current.source === "string"
              ? [current.source]
              : []
        const merged: Record<string, unknown> = {
            ...current,
            sources: currentSources,
        }
        for (const field of UPDATABLE_FIELDS) {
            if (field in updates) merged[field] = updates[field]
        }
        // Non-admins can never re-attribute a spell away from Homebrew.
        if (!caller.isAdmin) merged.sources = [HOMEBREW_SOURCE]

        const next = normalizeSpell(merged as unknown as StandardSpell)
        next.isHomebrew = next.sources.includes(HOMEBREW_SOURCE)

        const errors = validateSpell(next).filter((i) => i.severity === "error")
        if (errors.length) {
            return validationErrorResponse(
                errors.map((e) => e.message).join("; "),
            )
        }

        const now = new Date().toISOString()
        const setParts: string[] = [
            "#updatedAt = :updatedAt",
            "#isHomebrew = :isHomebrew",
            "#changelog = list_append(if_not_exists(#changelog, :emptyList), :newEntry)",
        ]
        const names: Record<string, string> = {
            "#updatedAt": "updatedAt",
            "#isHomebrew": "isHomebrew",
            "#changelog": "changelog",
            "#legacySource": "source",
        }
        const values: Record<string, unknown> = {
            ":updatedAt": now,
            ":isHomebrew": next.isHomebrew,
            ":emptyList": [],
            ":newEntry": [{ updatedBy, updatedAt: now }],
        }

        for (const field of UPDATABLE_FIELDS) {
            setParts.push(`#${field} = :${field}`)
            names[`#${field}`] = field
            values[`:${field}`] = next[field] ?? null
        }

        // Sharing only applies to homebrew; published spells are always public.
        // (DynamoDB rejects unused attribute names, so only define #shared when used.)
        const removeParts = ["#legacySource"]
        if (!next.isHomebrew) {
            removeParts.push("#shared")
            names["#shared"] = "shared"
        } else if (typeof updates.shared === "boolean") {
            setParts.push("#shared = :shared")
            names["#shared"] = "shared"
            values[":shared"] = updates.shared
        }

        const result = await docClient.send(
            new UpdateCommand({
                TableName: SPELLS_TABLE,
                Key: { spellId },
                UpdateExpression: `SET ${setParts.join(", ")} REMOVE ${removeParts.join(", ")}`,
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
