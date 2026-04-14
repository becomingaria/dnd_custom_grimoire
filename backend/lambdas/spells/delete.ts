import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

    if (!spellId) return errorResponse('Spell ID is required', 400);

    const existing = await docClient.send(
      new GetCommand({ TableName: SPELLS_TABLE, Key: { spellId } })
    );

    if (!existing.Item) return notFoundResponse('Spell');
    if (existing.Item.createdBy !== userId) return forbiddenResponse();

    await docClient.send(
      new DeleteCommand({ TableName: SPELLS_TABLE, Key: { spellId } })
    );

    return successResponse({ message: 'Spell deleted', spellId });
  } catch (error) {
    console.error('Error deleting spell:', error);
    return errorResponse('Failed to delete spell');
  }
};
