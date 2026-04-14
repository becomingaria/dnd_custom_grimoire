/**
 * Create-users script — provisions the two initial Cognito users for the Grimoire app.
 *
 * Usage:
 *   npm run create-users
 *
 * Environment variables (or .env file):
 *   USER_POOL_ID  — Cognito User Pool ID (from CDK stack output GrimoireUserPoolId)
 *   AWS_REGION    — AWS region (default: us-east-1)
 *
 * Users created:
 *   - becomingaria@gmail.com
 *   - kat.hallo@outlook.com
 *
 * Both users are created with AdminCreateUser and will receive a temporary
 * password via email. They must set a permanent password on first login.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminCreateUserCommandInput,
  AdminSetUserPasswordCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';

dotenv.config({ path: path.join(__dirname, '../.env') });

const USER_POOL_ID = process.env.USER_POOL_ID;
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!USER_POOL_ID) {
  console.error('❌ USER_POOL_ID environment variable is required.');
  console.error('   Set it in backend/.env after deploying the CDK stack.');
  process.exit(1);
}

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

interface UserToCreate {
  email: string;
  temporaryPassword: string;
  givenName?: string;
}

const USERS_TO_CREATE: UserToCreate[] = [
  {
    email: 'becomingaria@gmail.com',
    temporaryPassword: 'Grimoire1!',
    givenName: 'Aria',
  },
  {
    email: 'kat.hallo@outlook.com',
    temporaryPassword: 'Grimoire1!',
    givenName: 'Kat',
  },
];

async function createUser(user: UserToCreate): Promise<void> {
  console.log(`\n👤 Creating user: ${user.email}`);

  const input: AdminCreateUserCommandInput = {
    UserPoolId: USER_POOL_ID!,
    Username: user.email,
    TemporaryPassword: user.temporaryPassword,
    MessageAction: 'SUPPRESS', // Skip the welcome email with temp password
    UserAttributes: [
      { Name: 'email', Value: user.email },
      { Name: 'email_verified', Value: 'true' },
      ...(user.givenName ? [{ Name: 'given_name', Value: user.givenName }] : []),
    ],
  };

  try {
    const createResult = await cognitoClient.send(new AdminCreateUserCommand(input));
    const sub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;

    console.log(`  ✅ User created`);
    console.log(`     Sub (userId): ${sub}`);
    console.log(`     Email:        ${user.email}`);
    console.log(`     Temp pass:    ${user.temporaryPassword}`);
    console.log(`\n  💡 Update seed/characters.json with this sub if needed.`);

    // Set permanent password so user doesn't have to change on first login
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID!,
        Username: user.email,
        Password: user.temporaryPassword,
        Permanent: true,
      })
    );
    console.log(`  🔑 Password set as permanent (user can log in immediately)`);
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      console.log(`  ⏭️  Skipped — user already exists: ${user.email}`);
    } else {
      console.error(`  ❌ Failed to create ${user.email}:`, err);
    }
  }
}

async function main() {
  console.log('🧙 Grimoire — Create Users');
  console.log(`   Pool ID: ${USER_POOL_ID}`);
  console.log(`   Region:  ${REGION}`);

  for (const user of USERS_TO_CREATE) {
    await createUser(user);
  }

  console.log('\n✨ Done! Users can log in at the Grimoire app with their email and password.');
}

main().catch((err) => {
  console.error('create-users failed:', err);
  process.exit(1);
});
