import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, SPELLS_TABLE } from '../shared/dynamodb-client';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;

    if (!event.body) {
      return validationErrorResponse('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { name, level, school, castingTime, range, components, duration, description } = body;

    if (!name || level === undefined || !school || !castingTime || !range || !components || !duration || !description) {
      return validationErrorResponse(
        'Missing required fields: name, level, school, castingTime, range, components, duration, description'
      );
    }

    const now = new Date().toISOString();

    const spell = {
      spellId: uuidv4(),
      name: String(name).trim(),
      level: Number(level),
      school: String(school),
      castingTime: String(castingTime),
      range: String(range),
      components: Array.isArray(components) ? components : [components],
      materialComponents: body.materialComponents ?? null,
      duration: String(duration),
      concentration: Boolean(body.concentration),
      ritual: Boolean(body.ritual),
      description: String(description),
      higherLevels: body.higherLevels ?? null,
      classes: Array.isArray(body.classes) ? body.classes : [],
      isHomebrew: true,
      source: body.source ?? 'Homebrew',
      tags: Array.isArray(body.tags) ? body.tags : [],
      damageType: body.damageType ?? null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: SPELLS_TABLE,
        Item: spell,
        ConditionExpression: 'attribute_not_exists(spellId)',
      })
    );

    return successResponse(spell, 201);
  } catch (error) {
    console.error('Error creating spell:', error);
    return errorResponse('Failed to create spell');
  }
};
