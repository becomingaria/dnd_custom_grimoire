import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda"
import {
    DynamoDBClient,
    PutItemCommand,
    DeleteItemCommand,
} from "@aws-sdk/client-dynamodb"
import {
    CognitoIdentityProviderClient,
    AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
} from "../shared/response"

const dynamo = new DynamoDBClient({ region: process.env.REGION })
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.REGION,
})

const USERNAMES_TABLE = process.env.USERNAMES_TABLE!
const USER_POOL_ID = process.env.USER_POOL_ID!

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
    event,
) => {
    try {
        const claims = event.requestContext.authorizer.jwt.claims
        const userId = claims["sub"] as string
        const cognitoUsername = (claims["cognito:username"] ??
            claims["username"]) as string

        if (!userId || !cognitoUsername)
            return errorResponse("Unauthorized", 401)

        if (!event.body)
            return validationErrorResponse("Request body is required")

        const body = JSON.parse(event.body) as {
            username?: string
            oldUsername?: string
        }
        const newUsername = (body.username ?? "").trim()
        const oldUsername = (body.oldUsername ?? "").trim().toLowerCase()

        // ─── Clear username ────────────────────────────────────────────────────────
        if (!newUsername) {
            // Remove old username entry
            if (oldUsername) {
                await dynamo
                    .send(
                        new DeleteItemCommand({
                            TableName: USERNAMES_TABLE,
                            Key: { username: { S: oldUsername } },
                            ConditionExpression: "userId = :uid",
                            ExpressionAttributeValues: {
                                ":uid": { S: userId },
                            },
                        }),
                    )
                    .catch(() => {
                        // non-fatal – entry may not exist
                    })
            }

            await cognitoClient.send(
                new AdminUpdateUserAttributesCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: cognitoUsername,
                    UserAttributes: [{ Name: "name", Value: "" }],
                }),
            )

            return successResponse({ displayName: null })
        }

        // ─── Claim new username ────────────────────────────────────────────────────
        const normalizedNew = newUsername.toLowerCase()

        try {
            // Atomic write: only succeeds if no one owns this username, OR this same user already owns it
            await dynamo.send(
                new PutItemCommand({
                    TableName: USERNAMES_TABLE,
                    Item: {
                        username: { S: normalizedNew },
                        userId: { S: userId },
                    },
                    ConditionExpression:
                        "attribute_not_exists(username) OR userId = :uid",
                    ExpressionAttributeValues: { ":uid": { S: userId } },
                }),
            )
        } catch (err: unknown) {
            if (
                (err as { name?: string }).name ===
                "ConditionalCheckFailedException"
            ) {
                return errorResponse(`"${newUsername}" is already taken`, 409)
            }
            throw err
        }

        // ─── Release old username entry (if changed) ───────────────────────────────
        if (oldUsername && oldUsername !== normalizedNew) {
            await dynamo
                .send(
                    new DeleteItemCommand({
                        TableName: USERNAMES_TABLE,
                        Key: { username: { S: oldUsername } },
                        ConditionExpression: "userId = :uid",
                        ExpressionAttributeValues: { ":uid": { S: userId } },
                    }),
                )
                .catch(() => {
                    // non-fatal
                })
        }

        // ─── Update Cognito name attribute ─────────────────────────────────────────
        await cognitoClient.send(
            new AdminUpdateUserAttributesCommand({
                UserPoolId: USER_POOL_ID,
                Username: cognitoUsername,
                UserAttributes: [{ Name: "name", Value: newUsername }],
            }),
        )

        return successResponse({ displayName: newUsername })
    } catch (err) {
        console.error("setUsername error", err)
        return errorResponse("Internal server error")
    }
}
