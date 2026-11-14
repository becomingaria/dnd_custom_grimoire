/**
 * Patreon-gated access: compares Patreon members with Grimoire accounts and,
 * in "enforce" mode, disables accounts that aren't entitled.
 *
 * Safety rules:
 *   • admins, owner accounts and exempt emails are always allowed
 *   • enforcement never runs on a failed sync or one that returned 0 patrons
 *   • the sync only re-enables accounts it disabled itself
 *     (`disabledByPatreon`); manual disables by an admin are never undone
 *   • switching mode away from "enforce" restores everyone it disabled
 */
import {
    AdminDisableUserCommand,
    AdminEnableUserCommand,
    AdminUserGlobalSignOutCommand,
    type UserType,
} from "@aws-sdk/client-cognito-identity-provider"
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { docClient } from "./dynamodb-client"
import { ownerEmails } from "./auth"
import { cognito, listAdminUsernames, listAllUsers, userAttr } from "./cognito-users"
import {
    fetchCampaign,
    fetchMembers,
    loadCredentials,
    type PatreonMember,
    type PatreonTier,
} from "./patreon-client"

const SETTINGS_TABLE = process.env.SETTINGS_TABLE ?? "grimoire-settings"
const USER_POOL_ID = process.env.USER_POOL_ID!

export type AccessMode = "off" | "report" | "enforce"

export interface PatreonSettings {
    settingId: "patreon"
    mode: AccessMode
    campaign: { id: string; name: string; url: string | null } | null
    tiers: PatreonTier[]
    /** Empty = any active patron qualifies. */
    requiredTierIds: string[]
    /** Keep access while a payment is declined (Patreon's retry window). */
    allowDeclined: boolean
    /** Always allowed, patron or not (lowercased emails). */
    exemptEmails: string[]
    /** Grimoire email → Patreon member id, for patrons using another email. */
    links: Record<string, string>
    /** Cognito usernames this sync disabled (and may re-enable). */
    disabledByPatreon: string[]
    connectedAt: string | null
    lastSync: SyncReport | null
}

export type AccessReason =
    | "owner"
    | "admin"
    | "exempt"
    | "patron"
    | "declined-grace"
    | "not-a-patron"
    | "former-patron"
    | "declined"
    | "wrong-tier"

export interface PatronSummary {
    memberId: string
    name: string
    email: string | null
    status: string | null
    lastChargeStatus: string | null
    tierTitles: string[]
}

export interface UserAccessRow {
    username: string
    email: string
    displayName: string | null
    isAdmin: boolean
    enabled: boolean
    allowed: boolean
    reason: AccessReason
    linked: boolean
    patron: PatronSummary | null
}

export interface SyncReport {
    at: string
    mode: AccessMode
    ok: boolean
    error: string | null
    patronCount: number
    users: UserAccessRow[]
    /** Entitled patrons with no Grimoire account yet (invite candidates). */
    unclaimedPatrons: PatronSummary[]
    disabled: string[]
    enabled: string[]
    /** Why enforcement was skipped, if it was. */
    enforcementSkipped: string | null
}

export const DEFAULT_SETTINGS: PatreonSettings = {
    settingId: "patreon",
    mode: "off",
    campaign: null,
    tiers: [],
    requiredTierIds: [],
    allowDeclined: true,
    exemptEmails: [],
    links: {},
    disabledByPatreon: [],
    connectedAt: null,
    lastSync: null,
}

// ─── Settings storage ─────────────────────────────────────────────────────────

export async function loadSettings(): Promise<PatreonSettings> {
    const r = await docClient.send(
        new GetCommand({
            TableName: SETTINGS_TABLE,
            Key: { settingId: "patreon" },
        }),
    )
    return { ...DEFAULT_SETTINGS, ...(r.Item as Partial<PatreonSettings>) }
}

export async function saveSettings(s: PatreonSettings) {
    await docClient.send(new PutCommand({ TableName: SETTINGS_TABLE, Item: s }))
}

// ─── Access decision (pure) ───────────────────────────────────────────────────

const summarize = (m: PatreonMember): PatronSummary => ({
    memberId: m.memberId,
    name: m.name,
    email: m.email,
    status: m.status,
    lastChargeStatus: m.lastChargeStatus,
    tierTitles: m.tierTitles,
})

export function patronEntitlement(
    m: PatreonMember | undefined,
    s: Pick<PatreonSettings, "requiredTierIds" | "allowDeclined">,
): { allowed: boolean; reason: AccessReason } {
    if (!m) return { allowed: false, reason: "not-a-patron" }
    if (m.status === "declined_patron") {
        return s.allowDeclined
            ? { allowed: true, reason: "declined-grace" }
            : { allowed: false, reason: "declined" }
    }
    if (m.status !== "active_patron")
        return { allowed: false, reason: "former-patron" }
    if (
        s.requiredTierIds.length &&
        !m.tierIds.some((t) => s.requiredTierIds.includes(t))
    )
        return { allowed: false, reason: "wrong-tier" }
    return { allowed: true, reason: "patron" }
}

export function decideAccess(
    users: { username: string; email: string; displayName: string | null; enabled: boolean }[],
    adminUsernames: Set<string>,
    members: PatreonMember[],
    s: Pick<PatreonSettings, "requiredTierIds" | "allowDeclined" | "exemptEmails" | "links">,
    owners: string[],
): { rows: UserAccessRow[]; unclaimed: PatronSummary[] } {
    const byEmail = new Map(
        members.filter((m) => m.email).map((m) => [m.email!, m]),
    )
    const byId = new Map(members.map((m) => [m.memberId, m]))
    const claimed = new Set<string>()
    const exempt = new Set(s.exemptEmails.map((e) => e.toLowerCase()))

    const rows = users.map((u): UserAccessRow => {
        const linkedId = s.links[u.email]
        const member = (linkedId && byId.get(linkedId)) || byEmail.get(u.email)
        if (member) claimed.add(member.memberId)
        const isAdmin = adminUsernames.has(u.username)
        const base = {
            ...u,
            isAdmin,
            linked: !!linkedId && member?.memberId === linkedId,
            patron: member ? summarize(member) : null,
        }
        if (owners.includes(u.email)) return { ...base, allowed: true, reason: "owner" }
        if (isAdmin) return { ...base, allowed: true, reason: "admin" }
        if (exempt.has(u.email)) return { ...base, allowed: true, reason: "exempt" }
        return { ...base, ...patronEntitlement(member, s) }
    })

    const unclaimed = members
        .filter(
            (m) =>
                !claimed.has(m.memberId) &&
                patronEntitlement(m, s).allowed,
        )
        .map(summarize)
        .sort((a, b) => a.name.localeCompare(b.name))

    return { rows, unclaimed }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

function toUserRow(u: UserType) {
    return {
        username: u.Username ?? "",
        email: (userAttr(u, "email") ?? "").toLowerCase(),
        displayName: userAttr(u, "name") || null,
        enabled: u.Enabled ?? true,
    }
}

async function setEnabled(username: string, enabled: boolean) {
    if (enabled) {
        await cognito.send(
            new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
        )
    } else {
        await cognito.send(
            new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
        )
        await cognito.send(
            new AdminUserGlobalSignOutCommand({ UserPoolId: USER_POOL_ID, Username: username }),
        )
    }
}

/** Re-enables every account the sync disabled (mode left "enforce"). */
export async function restoreDisabled(s: PatreonSettings): Promise<string[]> {
    const restored: string[] = []
    for (const username of s.disabledByPatreon) {
        try {
            await setEnabled(username, true)
            restored.push(username)
        } catch (err) {
            // Deleted users can't be re-enabled; drop them either way.
            console.warn("restore failed for", username, err)
        }
    }
    s.disabledByPatreon = []
    return restored
}

/**
 * Fetches Patreon, decides access for every account and — only in enforce
 * mode with a trustworthy result — disables/re-enables accounts.
 * Always saves a report, even on failure.
 */
export async function runSync(
    s: PatreonSettings,
): Promise<{ settings: PatreonSettings; report: SyncReport }> {
    const at = new Date().toISOString()
    const report: SyncReport = {
        at,
        mode: s.mode,
        ok: false,
        error: null,
        patronCount: 0,
        users: [],
        unclaimedPatrons: [],
        disabled: [],
        enabled: [],
        enforcementSkipped: null,
    }

    try {
        const creds = await loadCredentials()
        if (!creds) throw new Error("Patreon isn't connected.")
        const ctx = { creds }
        const campaign = await fetchCampaign(ctx)
        s.campaign = { id: campaign.id, name: campaign.name, url: campaign.url }
        s.tiers = campaign.tiers
        const members = await fetchMembers(campaign.id, ctx)

        const [users, admins] = await Promise.all([
            listAllUsers(USER_POOL_ID),
            listAdminUsernames(USER_POOL_ID),
        ])
        const { rows, unclaimed } = decideAccess(
            users.map(toUserRow),
            admins,
            members,
            s,
            ownerEmails(),
        )
        report.ok = true
        report.patronCount = members.filter(
            (m) => m.status === "active_patron",
        ).length
        report.users = rows
        report.unclaimedPatrons = unclaimed

        if (s.mode === "enforce") {
            if (report.patronCount === 0) {
                report.enforcementSkipped =
                    "Patreon returned no active patrons — refusing to lock everyone out. Check the connection."
            } else {
                const disabledSet = new Set(s.disabledByPatreon)
                for (const row of rows) {
                    if (!row.allowed && row.enabled) {
                        await setEnabled(row.username, false)
                        disabledSet.add(row.username)
                        report.disabled.push(row.email)
                        row.enabled = false
                    } else if (row.allowed && disabledSet.has(row.username)) {
                        await setEnabled(row.username, true)
                        disabledSet.delete(row.username)
                        report.enabled.push(row.email)
                        row.enabled = true
                    }
                }
                // Forget accounts that no longer exist.
                const existing = new Set(rows.map((r) => r.username))
                s.disabledByPatreon = [...disabledSet].filter((u) => existing.has(u))
            }
        }
    } catch (err) {
        report.error = err instanceof Error ? err.message : String(err)
        if (s.mode === "enforce")
            report.enforcementSkipped = "Sync failed, so no accounts were changed."
    }

    s.lastSync = report
    await saveSettings(s)
    return { settings: s, report }
}
