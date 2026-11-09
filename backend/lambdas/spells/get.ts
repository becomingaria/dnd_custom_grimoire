import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, SPELLS_TABLE } from '../shared/dynamodb-client';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '../shared/response';
import { getCaller } from '../shared/auth';
import { canView, spellbookSpellIds } from '../shared/visibility';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const caller = getCaller(event);
    const spellId = event.pathParameters?.spellId;

    if (!spellId) {
      return errorResponse('Spell ID is required', 400);
    }

    const result = await docClient.send(
      new GetCommand({ TableName: SPELLS_TABLE, Key: { spellId } })
    );

    if (!result.Item) {
      return notFoundResponse('Spell');
    }

    // Same visibility rules as the list endpoint (shared/visibility.ts)
    if (!canView(result.Item, caller)) {
      const spellbook = await spellbookSpellIds(caller.userId);
      if (!canView(result.Item, caller, spellbook)) return forbiddenResponse();
    }

    return successResponse(result.Item);
  } catch (error) {
    console.error('Error getting spell:', error);
    return errorResponse('Failed to get spell');
  }
};
