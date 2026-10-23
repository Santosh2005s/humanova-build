export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string | { code?: string; message?: string; details?: unknown };
  message?: string;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    });
  } catch {
    throw new ApiError('Unable to connect to Humanova. Check that the server and database are running.', 0, 'NETWORK_ERROR');
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }

  if (!response.ok || !envelope.success || envelope.data === undefined) {
    const error = envelope.error;
    if (typeof error === 'string') {
      throw new ApiError(envelope.message || error, response.status, error);
    }
    throw new ApiError(error?.message || envelope.message || `Request failed (${response.status}).`, response.status, error?.code, error?.details);
  }
  return envelope.data;
}
