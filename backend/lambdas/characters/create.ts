import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, CHARACTERS_TABLE } from '../shared/dynamodb-client';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;

    if (!event.body) return validationErrorResponse('Request body is required');

    const body = JSON.parse(event.body);
    const { name, class: charClass, level, spellcastingAbility } = body;

    if (!name || !charClass || level === undefined || !spellcastingAbility) {
      return validationErrorResponse(
        'Missing required fields: name, class, level, spellcastingAbility'
      );
    }

    const now = new Date().toISOString();
    const character = {
      characterId: uuidv4(),
      userId,
      name: String(name).trim(),
      class: String(charClass),
      subclass: body.subclass ?? null,
      level: Number(level),
      knownSpellIds: Array.isArray(body.knownSpellIds) ? body.knownSpellIds : [],
      preparedSpellIds: Array.isArray(body.preparedSpellIds) ? body.preparedSpellIds : [],
      spellcastingAbility: String(spellcastingAbility),
      spellSaveDC: body.spellSaveDC ? Number(body.spellSaveDC) : null,
      spellAttackBonus: body.spellAttackBonus ? Number(body.spellAttackBonus) : null,
      notes: body.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: CHARACTERS_TABLE,
        Item: character,
        ConditionExpression: 'attribute_not_exists(characterId)',
      })
    );

    return successResponse(character, 201);
  } catch (error) {
    console.error('Error creating character:', error);
    return errorResponse('Failed to create character');
  }
};
