import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import { PutCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"
import { docClient, SPELLS_TABLE } from "../shared/dynamodb-client"
import { getCaller } from "../shared/auth"
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
} from "../shared/response"
import {
    normalizeSpell,
    validateSpell,
    HOMEBREW_SOURCE,
} from "../../../shared/spell-standard"

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const caller = getCaller(event)
        const addedBy = caller.email ?? caller.userId

        if (!event.body) {
            return validationErrorResponse("Request body is required")
        }

        const body = JSON.parse(event.body)

        // Only admins may attribute a spell to a published source; everyone
        // else's spells are Homebrew, credited to them via addedBy.
        const requestedSources: string[] = Array.isArray(body.sources)
            ? body.sources.map(String)
            : []
        const sources =
            caller.isAdmin && requestedSources.length
                ? requestedSources
                : [HOMEBREW_SOURCE]

        const now = new Date().toISOString()

        const spell = normalizeSpell({
            spellId: uuidv4(),
            name: String(body.name ?? ""),
            level: Number(body.level),
            school: String(body.school ?? ""),
            castingTime: String(body.castingTime ?? ""),
            range: String(body.range ?? ""),
            components: Array.isArray(body.components)
                ? body.components.map(String)
                : [],
            materialComponents: body.materialComponents ?? null,
            duration: String(body.duration ?? ""),
            concentration: Boolean(body.concentration),
            ritual: Boolean(body.ritual),
            description: String(body.description ?? ""),
            higherLevels: body.higherLevels ?? null,
            classes: Array.isArray(body.classes) ? body.classes.map(String) : [],
            sources,
            isHomebrew: false as boolean,
            tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
            damageType: body.damageType ?? null,
            addedBy,
            createdBy: caller.userId,
            createdAt: now,
            updatedAt: now,
            changelog: [],
        })
        spell.isHomebrew = spell.sources.includes(HOMEBREW_SOURCE)
        // Homebrew is private unless its author chooses to share it.
        const item = spell.isHomebrew
            ? { ...spell, shared: body.shared === true }
            : spell

        const errors = validateSpell(spell).filter((i) => i.severity === "error")
        if (errors.length) {
            return validationErrorResponse(
                errors.map((e) => e.message).join("; "),
            )
        }

        await docClient.send(
            new PutCommand({
                TableName: SPELLS_TABLE,
                Item: item,
                ConditionExpression: "attribute_not_exists(spellId)",
            }),
        )

        return successResponse(item, 201)
    } catch (error) {
        console.error("Error creating spell:", error)
        return errorResponse("Failed to create spell")
    }
}
