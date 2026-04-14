import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new ApiError(401, 'Not authenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const url = new URL(path, API_URL).toString();

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data: unknown = await res.json();

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const apiClient = {
  get:    <T>(path: string)                 => request<T>('GET', path),
  post:   <T>(path: string, body: unknown)  => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown)  => request<T>('PUT', path, body),
  delete: <T>(path: string)                => request<T>('DELETE', path),
};
