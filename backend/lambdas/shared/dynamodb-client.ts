import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.REGION ?? 'us-east-1',
});

const translateConfig: TranslateConfig = {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
};

export const docClient = DynamoDBDocumentClient.from(client, translateConfig);

export const SPELLS_TABLE = process.env.SPELLS_TABLE ?? 'grimoire-spells';
export const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE ?? 'grimoire-characters';
