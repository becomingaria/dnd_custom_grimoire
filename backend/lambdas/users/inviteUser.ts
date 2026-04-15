import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider"
import {
    successResponse,
    errorResponse,
    forbiddenResponse,
    validationErrorResponse,
} from "../shared/response"

const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.REGION,
})

const USER_POOL_ID = process.env.USER_POOL_ID!

/** Generates a random password satisfying the pool policy (8+ chars, upper, lower, digit). */
function generatePassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghjkmnpqrstuvwxyz"
    const digits = "23456789"
    const all = upper + lower + digits

    const rand = (chars: string) =>
        chars[Math.floor(Math.random() * chars.length)]

    const required = [rand(upper), rand(lower), rand(digits)]
    const extra = Array.from({ length: 9 }, () => rand(all))
    const password = [...required, ...extra]

    // Fisher-Yates shuffle
    for (let i = password.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[password[i], password[j]] = [password[j], password[i]]
    }
    return password.join("")
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        // ─── Auth: caller must be in Admin group ──────────────────────────────────
        const claims = event.requestContext.authorizer.jwt.claims
        const groups = (claims["cognito:groups"] ?? "") as string | string[]
        const groupList = Array.isArray(groups)
            ? groups
            : groups.split(",").map((g) => g.trim())

        if (!groupList.includes("Admin")) return forbiddenResponse()

        // ─── Validate body ────────────────────────────────────────────────────────
        if (!event.body)
            return validationErrorResponse("Request body is required")

        const body = JSON.parse(event.body) as { email?: string }
        const email = (body.email ?? "").trim().toLowerCase()

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return validationErrorResponse("A valid email address is required")
        }

        const tempPassword = generatePassword()

        // ─── Try to create the user ───────────────────────────────────────────────
        try {
            await cognitoClient.send(
                new AdminCreateUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    TemporaryPassword: tempPassword,
                    UserAttributes: [
                        { Name: "email", Value: email },
                        { Name: "email_verified", Value: "true" },
                    ],
                    // Cognito will send an invitation email with the temp password
                    DesiredDeliveryMediums: ["EMAIL"],
                }),
            )

            return successResponse({ created: true, email })
        } catch (err: unknown) {
            if (err instanceof UsernameExistsException) {
                // ─── User already exists — reset password + force change ──────────
                await cognitoClient.send(
                    new AdminSetUserPasswordCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: email,
                        Password: tempPassword,
                        Permanent: false, // forces password change on next login
                    }),
                )

                // Re-send the invitation by creating a temporary invite message
                // We do this by triggering a resend via AdminCreateUser with RESEND action
                await cognitoClient.send(
                    new AdminCreateUserCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: email,
                        MessageAction: "RESEND",
                        TemporaryPassword: tempPassword,
                        DesiredDeliveryMediums: ["EMAIL"],
                    }),
                )

                return successResponse({ created: false, reset: true, email })
            }

            throw err
        }
    } catch (err: unknown) {
        console.error("inviteUser error:", err)
        const message = err instanceof Error ? err.message : "Internal error"
        return errorResponse(message, 500)
    }
}
