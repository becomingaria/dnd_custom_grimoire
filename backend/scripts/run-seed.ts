/**
 * Seed script — populates DynamoDB with spells and characters from seed JSON files.
 *
 * Usage:
 *   npm run seed
 *
 * Environment variables (or .env file):
 *   SPELLS_TABLE      — DynamoDB table name for spells   (default: grimoire-spells)
 *   CHARACTERS_TABLE  — DynamoDB table name for characters (default: grimoire-characters)
 *   AWS_REGION        — AWS region                        (default: us-east-1)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SPELLS_TABLE = process.env.SPELLS_TABLE ?? 'grimoire-spells';
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE ?? 'grimoire-characters';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function getTableCount(tableName: string): Promise<number> {
  const result = await docClient.send(new ScanCommand({ TableName: tableName, Select: 'COUNT' }));
  return result.Count ?? 0;
}

async function seedTable<T extends Record<string, unknown>>(
  tableName: string,
  items: T[],
  idKey: string
): Promise<void> {
  console.log(`\n📦 Seeding ${tableName} (${items.length} items)...`);

  let seeded = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: `attribute_not_exists(${idKey})`,
        })
      );
      console.log(`  ✅ Seeded: ${item.name as string} (${item[idKey] as string})`);
      seeded++;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
        console.log(`  ⏭️  Skipped (exists): ${item.name as string}`);
        skipped++;
      } else {
        console.error(`  ❌ Failed: ${item.name as string}`, err);
      }
    }
  }

  console.log(`\n  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function main() {
  console.log('🌱 Grimoire Seed Script');
  console.log(`   Region:    ${REGION}`);
  console.log(`   Spells:    ${SPELLS_TABLE}`);
  console.log(`   Characters: ${CHARACTERS_TABLE}`);

  // ─── Seed Spells ────────────────────────────────────────────────────────────
  const spellsPath = path.join(__dirname, '../seed/spells.json');
  const { spells } = JSON.parse(fs.readFileSync(spellsPath, 'utf-8')) as {
    spells: Record<string, unknown>[];
  };

  await seedTable(SPELLS_TABLE, spells, 'spellId');

  // ─── Seed Characters ─────────────────────────────────────────────────────────
  // NOTE: Characters have a `userId` that must match a real Cognito user's sub.
  //       Update seed/characters.json with real user sub IDs before seeding.
  const charactersPath = path.join(__dirname, '../seed/characters.json');
  const { characters } = JSON.parse(fs.readFileSync(charactersPath, 'utf-8')) as {
    characters: Record<string, unknown>[];
  };

  const hasPlaceholderUser = characters.some((c) => c.userId === 'REPLACE_WITH_USER_SUB');
  if (hasPlaceholderUser) {
    console.warn(
      '\n⚠️  Characters have placeholder userId. Update seed/characters.json with real Cognito sub IDs.'
    );
    console.warn('   Run `npm run create-users` first, then copy the sub IDs into characters.json.\n');
  }

  await seedTable(CHARACTERS_TABLE, characters, 'characterId');

  console.log('\n✨ Seed complete!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
