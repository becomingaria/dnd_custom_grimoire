import { QueryCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, CHARACTERS_TABLE } from "./dynamodb-client"
import type { Caller } from "./auth"

/**
 * Who can see a spell:
 *   • published (non-homebrew) spells — everyone
 *   • homebrew — its author, admins, and everyone else only when shared
 *   • a private homebrew spell already in one of your characters' spellbooks
 *     stays visible to you, so un-sharing never breaks a spellbook
 *
 * Homebrew is private unless `shared === true`, including older homebrew
 * created before sharing existed (it has no `shared` attribute).
 */
export function isShared(item: Record<string, unknown>): boolean {
    return item.shared === true
}

export function canView(
    item: Record<string, unknown>,
    caller: Caller,
    spellbookIds: Set<string> = new Set(),
): boolean {
    if (!item.isHomebrew) return true
    if (caller.isAdmin || item.createdBy === caller.userId) return true
    if (isShared(item)) return true
    return spellbookIds.has(String(item.spellId))
}

/** Every spell id known or prepared by any of the caller's characters. */
export async function spellbookSpellIds(userId: string): Promise<Set<string>> {
    const ids = new Set<string>()
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new QueryCommand({
                TableName: CHARACTERS_TABLE,
                IndexName: "byUser",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ProjectionExpression: "knownSpellIds, preparedSpellIds",
                ExclusiveStartKey: lastKey,
            }),
        )
        for (const c of r.Items ?? []) {
            for (const id of [
                ...((c.knownSpellIds as string[]) ?? []),
                ...((c.preparedSpellIds as string[]) ?? []),
            ])
                ids.add(id)
        }
        lastKey = r.LastEvaluatedKey
    } while (lastKey)
    return ids
}
