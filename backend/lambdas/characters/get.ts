import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
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

    const result = await docClient.send(
      new GetCommand({ TableName: CHARACTERS_TABLE, Key: { characterId } })
    );

    if (!result.Item) return notFoundResponse('Character');
    if (result.Item.userId !== userId) return forbiddenResponse();

    return successResponse(result.Item);
  } catch (error) {
    console.error('Error getting character:', error);
    return errorResponse('Failed to get character');
  }
};
