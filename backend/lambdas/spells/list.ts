import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, SPELLS_TABLE } from '../shared/dynamodb-client';
import { successResponse, errorResponse } from '../shared/response';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;
    const q = event.queryStringParameters ?? {};

    // Scan full table — for production with large datasets, use GSI + Query
    const result = await docClient.send(new ScanCommand({ TableName: SPELLS_TABLE }));
    let spells = result.Items ?? [];

    // Show global (non-homebrew) spells + the caller's own homebrew
    spells = spells.filter((s) => !s.isHomebrew || s.createdBy === userId);

    // Optional query-param filters
    if (q.school) {
      spells = spells.filter((s) => s.school.toLowerCase() === q.school!.toLowerCase());
    }
    if (q.level !== undefined) {
      spells = spells.filter((s) => s.level === Number(q.level));
    }
    if (q.homebrew !== undefined) {
      spells = spells.filter((s) => s.isHomebrew === (q.homebrew === 'true'));
    }
    if (q.class) {
      spells = spells.filter((s) =>
        Array.isArray(s.classes) &&
        s.classes.some((c: string) => c.toLowerCase() === q.class!.toLowerCase())
      );
    }

    // Sort: by level asc, then alphabetically
    spells.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return String(a.name).localeCompare(String(b.name));
    });

    return successResponse({ spells, count: spells.length });
  } catch (error) {
    console.error('Error listing spells:', error);
    return errorResponse('Failed to list spells');
  }
};
