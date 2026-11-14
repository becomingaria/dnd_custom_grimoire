import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    ListUsersInGroupCommand,
    type UserType,
} from "@aws-sdk/client-cognito-identity-provider"
import { ADMIN_GROUP } from "./auth"

export const cognito = new CognitoIdentityProviderClient({
    region: process.env.REGION,
})

/** Every user in the pool (pages through ListUsers). */
export async function listAllUsers(userPoolId: string): Promise<UserType[]> {
    const users: UserType[] = []
    let token: string | undefined
    do {
        const r = await cognito.send(
            new ListUsersCommand({
                UserPoolId: userPoolId,
                Limit: 60,
                PaginationToken: token,
            }),
        )
        users.push(...(r.Users ?? []))
        token = r.PaginationToken
    } while (token)
    return users
}

/** Cognito usernames in the Admin group. */
export async function listAdminUsernames(
    userPoolId: string,
): Promise<Set<string>> {
    const names = new Set<string>()
    let next: string | undefined
    do {
        const r = await cognito.send(
            new ListUsersInGroupCommand({
                UserPoolId: userPoolId,
                GroupName: ADMIN_GROUP,
                NextToken: next,
            }),
        )
        for (const u of r.Users ?? []) if (u.Username) names.add(u.Username)
        next = r.NextToken
    } while (next)
    return names
}

export const userAttr = (u: UserType, name: string) =>
    u.Attributes?.find((a) => a.Name === name)?.Value
