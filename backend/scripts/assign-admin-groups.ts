/**
 * assign-admin-groups — adds specified users to the Cognito "Admin" group.
 *
 * Usage:
 *   npm run assign-admins
 *
 * Environment variables (or backend/.env):
 *   USER_POOL_ID — Cognito User Pool ID
 *   AWS_REGION   — AWS region (default: us-east-1)
 */

import * as dotenv from "dotenv"
import * as path from "path"
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider"

dotenv.config({ path: path.join(__dirname, "../.env") })

const USER_POOL_ID = process.env.USER_POOL_ID
const REGION = process.env.AWS_REGION ?? "us-east-1"

if (!USER_POOL_ID) {
    console.error("❌ USER_POOL_ID environment variable is required.")
    process.exit(1)
}

const client = new CognitoIdentityProviderClient({ region: REGION })

const ADMIN_USERS = ["becomingaria@gmail.com", "kat.hallo@outlook.com"]

async function assignAdmin(email: string): Promise<void> {
    console.log(`\n👤 Assigning Admin group → ${email}`)
    try {
        await client.send(
            new AdminAddUserToGroupCommand({
                UserPoolId: USER_POOL_ID!,
                Username: email,
                GroupName: "Admin",
            }),
        )
        console.log(`  ✅ Done`)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`  ❌ Failed: ${message}`)
    }
}

async function main() {
    console.log("🔐 Assigning Admin group to Grimoire admins…")
    for (const email of ADMIN_USERS) {
        await assignAdmin(email)
    }
    console.log("\n✨ Complete.")
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
