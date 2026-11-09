import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"

export const ADMIN_GROUP = "Admin"
export const USER_GROUP = "User"

export interface Caller {
    /** Cognito `sub` — stable user id used as createdBy / userId. */
    userId: string
    /** Cognito username (for this pool, a UUID; email is a sign-in alias). */
    username: string
    email: string | undefined
    groups: string[]
    isAdmin: boolean
}

/**
 * API Gateway HTTP API flattens JWT claims to Record<string, string>, so an
 * array-valued claim like `cognito:groups` arrives as a JSON-array string
 * (e.g. `["Admin"]`) or a bracketed list (`[Admin User]`), not an array.
 */
export function parseGroupClaim(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String)
    if (typeof raw !== "string" || !raw.trim()) return []

    const trimmed = raw.trim()
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed.map(String)
        } catch {
            // `[Admin User]` — not valid JSON; strip brackets and split below.
            return trimmed
                .slice(1, -1)
                .split(/[\s,]+/)
                .filter(Boolean)
        }
    }
    return trimmed
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
}

export function getCaller(event: APIGatewayProxyEventV2WithJWTAuthorizer): Caller {
    const claims = event.requestContext.authorizer.jwt.claims
    const groups = parseGroupClaim(claims["cognito:groups"])
    return {
        userId: String(claims["sub"] ?? ""),
        username: String(claims["cognito:username"] ?? claims["username"] ?? ""),
        email: claims["email"] ? String(claims["email"]) : undefined,
        groups,
        isAdmin: groups.includes(ADMIN_GROUP),
    }
}

/** Emails that can never be demoted, disabled or deleted through the API. */
export function ownerEmails(): string[] {
    return (process.env.OWNER_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
}
