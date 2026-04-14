import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, CHARACTERS_TABLE } from '../shared/dynamodb-client';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;
    const characterId = event.pathParameters?.characterId;

    if (!characterId) return errorResponse('Character ID is required', 400);

    const existing = await docClient.send(
      new GetCommand({ TableName: CHARACTERS_TABLE, Key: { characterId } })
    );

    if (!existing.Item) return notFoundResponse('Character');
    if (existing.Item.userId !== userId) return forbiddenResponse();

    await docClient.send(
      new DeleteCommand({ TableName: CHARACTERS_TABLE, Key: { characterId } })
    );

    return successResponse({ message: 'Character deleted', characterId });
  } catch (error) {
    console.error('Error deleting character:', error);
    return errorResponse('Failed to delete character');
  }
};
