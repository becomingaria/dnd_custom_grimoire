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
