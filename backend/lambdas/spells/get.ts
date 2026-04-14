import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, SPELLS_TABLE } from '../shared/dynamodb-client';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;
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

    // Homebrew spells are private to their creator
    if (result.Item.isHomebrew && result.Item.createdBy !== userId) {
      return forbiddenResponse();
    }

    return successResponse(result.Item);
  } catch (error) {
    console.error('Error getting spell:', error);
    return errorResponse('Failed to get spell');
  }
};
