/**
 * Admin user management — one Lambda serving every /admin/users route.
 *
 *   GET    /admin/users              list users with role, status and usage
 *   POST   /admin/users              invite { email, role?, resetPassword? }
 *   PUT    /admin/users/{username}   update { role?: "admin"|"user", enabled?: boolean }
 *   DELETE /admin/users/{username}   delete user + their characters
 *   POST   /users/invite             legacy alias of POST /admin/users
 *
 * Every route requires the caller to be in the Cognito "Admin" group.
 * Guardrails: callers cannot change their own access, and accounts listed in
 * OWNER_EMAILS can never be demoted, disabled or deleted.
 */
import type {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda"
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
    AdminCreateUserCommand,
    AdminDeleteUserCommand,
    AdminDisableUserCommand,
    AdminEnableUserCommand,
    AdminGetUserCommand,
    AdminListGroupsForUserCommand,
    AdminRemoveUserFromGroupCommand,
    AdminSetUserPasswordCommand,
    AdminUserGlobalSignOutCommand,
    ListUsersCommand,
    ListUsersInGroupCommand,
    UserNotFoundException,
    UsernameExistsException,
    type AttributeType,
    type UserType,
} from "@aws-sdk/client-cognito-identity-provider"
import {
    DeleteCommand,
    QueryCommand,
    type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb"
import { docClient, SPELLS_TABLE, CHARACTERS_TABLE } from "../shared/dynamodb-client"
import {
    getCaller,
    ownerEmails,
    ADMIN_GROUP,
    USER_GROUP,
    type Caller,
} from "../shared/auth"
import {
    successResponse,
    errorResponse,
    forbiddenResponse,
    notFoundResponse,
    validationErrorResponse,
    type ApiResponse,
} from "../shared/response"

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION })
const USER_POOL_ID = process.env.USER_POOL_ID!
const USERNAMES_TABLE = process.env.USERNAMES_TABLE!

type Role = "admin" | "user"

export interface AdminUser {
    username: string
    userId: string
    email: string
    displayName: string | null
    status: string
    enabled: boolean
    role: Role
    isOwner: boolean
    createdAt: string | null
    lastModifiedAt: string | null
    characterCount: number
    homebrewCount: number
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const caller = getCaller(event)
        if (!caller.isAdmin) return forbiddenResponse()

        switch (event.routeKey) {
            case "GET /admin/users":
                return await listUsers()
            case "POST /admin/users":
            case "POST /users/invite":
                return await inviteUser(event)
            case "PUT /admin/users/{username}":
                return await updateUser(event, caller)
            case "DELETE /admin/users/{username}":
                return await deleteUser(event, caller)
            default:
                return notFoundResponse("Route")
        }
    } catch (err) {
        console.error("admin/users error:", err)
        if (err instanceof UserNotFoundException) return notFoundResponse("User")
        const message = err instanceof Error ? err.message : "Internal error"
        return errorResponse(message, 500)
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const attr = (attrs: AttributeType[] | undefined, name: string) =>
    attrs?.find((a) => a.Name === name)?.Value

function toAdminUser(
    u: {
        Username?: string
        Attributes?: AttributeType[]
        UserAttributes?: AttributeType[]
        UserStatus?: string
        Enabled?: boolean
        UserCreateDate?: Date
        UserLastModifiedDate?: Date
    },
    isAdmin: boolean,
    counts = { characterCount: 0, homebrewCount: 0 },
): AdminUser {
    const attrs = u.Attributes ?? u.UserAttributes
    const email = (attr(attrs, "email") ?? "").toLowerCase()
    return {
        username: u.Username ?? "",
        userId: attr(attrs, "sub") ?? "",
        email,
        displayName: attr(attrs, "name") || null,
        status: u.UserStatus ?? "UNKNOWN",
        enabled: u.Enabled ?? true,
        role: isAdmin ? "admin" : "user",
        isOwner: ownerEmails().includes(email),
        createdAt: u.UserCreateDate?.toISOString() ?? null,
        lastModifiedAt: u.UserLastModifiedDate?.toISOString() ?? null,
        ...counts,
    }
}

async function countByUser(
    table: string,
    keyName: string,
    userId: string,
    filter?: Pick<
        QueryCommandInput,
        | "FilterExpression"
        | "ExpressionAttributeNames"
        | "ExpressionAttributeValues"
    >,
): Promise<number> {
    let count = 0
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new QueryCommand({
                TableName: table,
                IndexName: "byUser",
                KeyConditionExpression: "#k = :uid",
                Select: "COUNT",
                ExclusiveStartKey: lastKey,
                ...filter,
                ExpressionAttributeNames: {
                    "#k": keyName,
                    ...filter?.ExpressionAttributeNames,
                },
                ExpressionAttributeValues: {
                    ":uid": userId,
                    ...filter?.ExpressionAttributeValues,
                },
            }),
        )
        count += r.Count ?? 0
        lastKey = r.LastEvaluatedKey
    } while (lastKey)
    return count
}

async function getUsage(userId: string) {
    if (!userId) return { characterCount: 0, homebrewCount: 0 }
    const [characterCount, homebrewCount] = await Promise.all([
        countByUser(CHARACTERS_TABLE, "userId", userId),
        countByUser(SPELLS_TABLE, "createdBy", userId, {
            FilterExpression: "#hb = :true",
            ExpressionAttributeNames: { "#hb": "isHomebrew" },
            ExpressionAttributeValues: { ":true": true },
        }),
    ])
    return { characterCount, homebrewCount }
}

async function isInAdminGroup(username: string): Promise<boolean> {
    const r = await cognito.send(
        new AdminListGroupsForUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
        }),
    )
    return (r.Groups ?? []).some((g) => g.GroupName === ADMIN_GROUP)
}

async function loadAdminUser(username: string): Promise<AdminUser> {
    const u = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
    )
    const user = toAdminUser(u, await isInAdminGroup(username))
    return { ...user, ...(await getUsage(user.userId)) }
}

async function setRole(username: string, role: Role) {
    await cognito.send(
        new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: USER_GROUP,
        }),
    )
    const command =
        role === "admin"
            ? new AdminAddUserToGroupCommand({
                  UserPoolId: USER_POOL_ID,
                  Username: username,
                  GroupName: ADMIN_GROUP,
              })
            : new AdminRemoveUserFromGroupCommand({
                  UserPoolId: USER_POOL_ID,
                  Username: username,
                  GroupName: ADMIN_GROUP,
              })
    await cognito.send(command)
}

/** Refuses changes to the caller's own account or to an owner account. */
function guardTarget(target: AdminUser, caller: Caller): ApiResponse | null {
    if (target.userId === caller.userId)
        return validationErrorResponse(
            "You can't change your own access — ask another admin.",
        )
    if (target.isOwner)
        return errorResponse(
            "The owner account can't be demoted, disabled or deleted.",
            403,
        )
    return null
}

/** Random password satisfying the pool policy (8+ chars, upper, lower, digit). */
function generatePassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghjkmnpqrstuvwxyz"
    const digits = "23456789"
    const all = upper + lower + digits
    const bytes = new Uint32Array(12)
    crypto.getRandomValues(bytes)
    const pick = (chars: string, i: number) => chars[bytes[i] % chars.length]
    const password = [
        pick(upper, 0),
        pick(lower, 1),
        pick(digits, 2),
        ...Array.from({ length: 9 }, (_, i) => pick(all, i + 3)),
    ]
    for (let i = password.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[password[i], password[j]] = [password[j], password[i]]
    }
    return password.join("")
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function listUsers(): Promise<ApiResponse> {
    const users: UserType[] = []
    let token: string | undefined
    do {
        const r = await cognito.send(
            new ListUsersCommand({
                UserPoolId: USER_POOL_ID,
                Limit: 60,
                PaginationToken: token,
            }),
        )
        users.push(...(r.Users ?? []))
        token = r.PaginationToken
    } while (token)

    const adminNames = new Set<string>()
    let next: string | undefined
    do {
        const r = await cognito.send(
            new ListUsersInGroupCommand({
                UserPoolId: USER_POOL_ID,
                GroupName: ADMIN_GROUP,
                NextToken: next,
            }),
        )
        for (const u of r.Users ?? []) if (u.Username) adminNames.add(u.Username)
        next = r.NextToken
    } while (next)

    const result = await Promise.all(
        users.map(async (u) => {
            const base = toAdminUser(u, adminNames.has(u.Username ?? ""))
            return { ...base, ...(await getUsage(base.userId)) }
        }),
    )
    result.sort((a, b) => a.email.localeCompare(b.email))
    return successResponse({ users: result })
}

async function inviteUser(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<ApiResponse> {
    if (!event.body) return validationErrorResponse("Request body is required")
    const body = JSON.parse(event.body) as {
        email?: string
        role?: Role
        resetPassword?: boolean
    }
    const email = (body.email ?? "").trim().toLowerCase()
    const role: Role = body.role === "admin" ? "admin" : "user"

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return validationErrorResponse("A valid email address is required")
    }

    const tempPassword = generatePassword()

    try {
        const created = await cognito.send(
            new AdminCreateUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
                TemporaryPassword: tempPassword,
                UserAttributes: [
                    { Name: "email", Value: email },
                    { Name: "email_verified", Value: "true" },
                ],
                DesiredDeliveryMediums: ["EMAIL"],
            }),
        )
        const username = created.User?.Username ?? email
        await setRole(username, role)
        return successResponse(
            {
                created: true,
                email,
                user: await loadAdminUser(username),
            },
            201,
        )
    } catch (err) {
        if (!(err instanceof UsernameExistsException)) throw err
    }

    // ── Existing account ─────────────────────────────────────────────────────
    const existing = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    )
    const pending = existing.UserStatus === "FORCE_CHANGE_PASSWORD"
    if (!pending && !body.resetPassword) {
        return errorResponse(
            `${email} already has an active account. Use "Reset password" if they're locked out.`,
            409,
        )
    }
    if (ownerEmails().includes(email) && body.resetPassword) {
        return errorResponse("The owner account's password can't be reset here.", 403)
    }

    // Force a new temporary password and re-send the invitation email.
    await cognito.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: tempPassword,
            Permanent: false,
        }),
    )
    await cognito.send(
        new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            MessageAction: "RESEND",
            TemporaryPassword: tempPassword,
            DesiredDeliveryMediums: ["EMAIL"],
        }),
    )
    const username = existing.Username ?? email
    return successResponse({
        created: false,
        reset: true,
        email,
        user: await loadAdminUser(username),
    })
}

async function updateUser(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    caller: Caller,
): Promise<ApiResponse> {
    const username = decodeURIComponent(event.pathParameters?.username ?? "")
    if (!username) return validationErrorResponse("Username is required")
    if (!event.body) return validationErrorResponse("Request body is required")

    const body = JSON.parse(event.body) as { role?: Role; enabled?: boolean }
    if (body.role === undefined && body.enabled === undefined)
        return validationErrorResponse('Provide "role" and/or "enabled"')
    if (body.role !== undefined && body.role !== "admin" && body.role !== "user")
        return validationErrorResponse('role must be "admin" or "user"')

    const target = await loadAdminUser(username)
    const blocked = guardTarget(target, caller)
    if (blocked) return blocked

    let revokeSessions = false

    if (body.role && body.role !== target.role) {
        await setRole(username, body.role)
        // Groups live in the ID token; force a fresh sign-in so a demotion
        // takes effect as soon as current tokens expire (≤ 1 hour).
        if (body.role === "user") revokeSessions = true
    }

    if (body.enabled !== undefined && body.enabled !== target.enabled) {
        await cognito.send(
            body.enabled
                ? new AdminEnableUserCommand({
                      UserPoolId: USER_POOL_ID,
                      Username: username,
                  })
                : new AdminDisableUserCommand({
                      UserPoolId: USER_POOL_ID,
                      Username: username,
                  }),
        )
        if (!body.enabled) revokeSessions = true
    }

    if (revokeSessions) {
        await cognito.send(
            new AdminUserGlobalSignOutCommand({
                UserPoolId: USER_POOL_ID,
                Username: username,
            }),
        )
    }

    return successResponse({ user: await loadAdminUser(username) })
}

async function deleteUser(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    caller: Caller,
): Promise<ApiResponse> {
    const username = decodeURIComponent(event.pathParameters?.username ?? "")
    if (!username) return validationErrorResponse("Username is required")

    const target = await loadAdminUser(username)
    const blocked = guardTarget(target, caller)
    if (blocked) return blocked

    // Remove sign-in access first, then clean up their private data.
    await cognito.send(
        new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
    )

    let charactersDeleted = 0
    let lastKey: Record<string, unknown> | undefined
    do {
        const r = await docClient.send(
            new QueryCommand({
                TableName: CHARACTERS_TABLE,
                IndexName: "byUser",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": target.userId },
                ProjectionExpression: "characterId",
                ExclusiveStartKey: lastKey,
            }),
        )
        for (const item of r.Items ?? []) {
            await docClient.send(
                new DeleteCommand({
                    TableName: CHARACTERS_TABLE,
                    Key: { characterId: item.characterId },
                }),
            )
            charactersDeleted++
        }
        lastKey = r.LastEvaluatedKey
    } while (lastKey)

    // Free their display name so someone else can claim it.
    if (target.displayName) {
        await docClient
            .send(
                new DeleteCommand({
                    TableName: USERNAMES_TABLE,
                    Key: { username: target.displayName.toLowerCase() },
                    ConditionExpression: "userId = :uid",
                    ExpressionAttributeValues: { ":uid": target.userId },
                }),
            )
            .catch(() => undefined)
    }

    // Homebrew spells are kept: they're shared content and stay credited to
    // the author through their `addedBy` attribute.
    return successResponse({
        deleted: true,
        email: target.email,
        charactersDeleted,
        homebrewKept: target.homebrewCount,
    })
}
