import { apiClient } from "./client"

export type UserRole = "admin" | "user"

/** Mirrors AdminUser in backend/lambdas/admin/users.ts */
export interface AdminUser {
    username: string
    userId: string
    email: string
    displayName: string | null
    /** Cognito status: CONFIRMED, FORCE_CHANGE_PASSWORD (invite pending), … */
    status: string
    enabled: boolean
    role: UserRole
    isOwner: boolean
    createdAt: string | null
    lastModifiedAt: string | null
    characterCount: number
    homebrewCount: number
    /** Disabled by the Patreon access sync rather than by an admin. */
    patreonDisabled?: boolean
}

export interface InviteUserInput {
    email: string
    role?: UserRole
    /** Required to re-send credentials to an already-active account. */
    resetPassword?: boolean
}

export interface InviteUserResponse {
    email: string
    created: boolean
    reset?: boolean
    user: AdminUser
}

export interface DeleteUserResponse {
    deleted: boolean
    email: string
    charactersDeleted: number
    homebrewKept: number
}

const userPath = (username: string) =>
    `/admin/users/${encodeURIComponent(username)}`

export const adminApi = {
    listUsers: () => apiClient.get<{ users: AdminUser[] }>("/admin/users"),

    inviteUser: (input: InviteUserInput) =>
        apiClient.post<InviteUserResponse>("/admin/users", input),

    updateUser: (
        username: string,
        changes: { role?: UserRole; enabled?: boolean },
    ) => apiClient.put<{ user: AdminUser }>(userPath(username), changes),

    deleteUser: (username: string) =>
        apiClient.delete<DeleteUserResponse>(userPath(username)),
}

// ─── Patreon access (mirrors backend/lambdas/shared/patreon-sync.ts) ─────────

export type AccessMode = "off" | "report" | "enforce"

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

export interface PatreonTier {
    id: string
    title: string
    amountCents: number
    published: boolean
}

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
    unclaimedPatrons: PatronSummary[]
    disabled: string[]
    enabled: string[]
    enforcementSkipped: string | null
}

export interface PatreonSettings {
    mode: AccessMode
    campaign: { id: string; name: string; url: string | null } | null
    tiers: PatreonTier[]
    requiredTierIds: string[]
    allowDeclined: boolean
    exemptEmails: string[]
    links: Record<string, string>
    disabledByPatreon: string[]
    connectedAt: string | null
    lastSync: SyncReport | null
}

export interface PatreonStatus {
    connected: boolean
    settings: PatreonSettings
}

export interface PatreonCredentialsInput {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
}

export type PatreonUpdate = Partial<{
    credentials: PatreonCredentialsInput
    mode: AccessMode
    requiredTierIds: string[]
    allowDeclined: boolean
    exemptEmails: string[]
    links: Record<string, string>
}>

export const patreonApi = {
    status: () => apiClient.get<PatreonStatus>("/admin/patreon"),
    update: (changes: PatreonUpdate) =>
        apiClient.put<PatreonStatus>("/admin/patreon", changes),
    sync: () => apiClient.post<PatreonStatus>("/admin/patreon/sync", {}),
    disconnect: () => apiClient.delete<PatreonStatus>("/admin/patreon"),
}
