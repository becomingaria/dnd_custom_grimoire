export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export const successResponse = (data: unknown, statusCode = 200): ApiResponse => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(data),
});

export const errorResponse = (message: string, statusCode = 500): ApiResponse => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

export const notFoundResponse = (resource = 'Resource'): ApiResponse =>
  errorResponse(`${resource} not found`, 404);

export const forbiddenResponse = (): ApiResponse =>
  errorResponse('You do not have permission to perform this action', 403);

export const validationErrorResponse = (message: string): ApiResponse =>
  errorResponse(message, 400);
