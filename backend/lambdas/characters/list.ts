import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, CHARACTERS_TABLE } from '../shared/dynamodb-client';
import { successResponse, errorResponse } from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;

    const result = await docClient.send(
      new QueryCommand({
        TableName: CHARACTERS_TABLE,
        IndexName: 'byUser',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false, // newest first
      })
    );

    return successResponse({ characters: result.Items ?? [], count: result.Count ?? 0 });
  } catch (error) {
    console.error('Error listing characters:', error);
    return errorResponse('Failed to list characters');
  }
};
