// The single place that talks to new-funnel-backend. Everything above this
// file deals in plain data and never sees fetch, headers, or the response
// envelope.

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001'
).replace(/\/+$/, '');

const TOKEN_KEY = 'iq-admin-token';

/** Matches the backend's ApiResponse envelope. */
interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: { message: string; details?: unknown };
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// --- token storage -------------------------------------------------------
// localStorage rather than a cookie: the backend issues a bearer token, and
// the 60-day session should survive a browser restart.

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // A blocked write only costs us session persistence, not the session.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// --- 401 handling --------------------------------------------------------
// A token can be rejected mid-session: it expired, or an operator's account
// was deactivated. AuthProvider registers a handler here so any request can
// drop the session and bounce the user to /login.

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Login must not trigger the global sign-out on a 401. */
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * The message to show for a failed request.
 *
 * A 400 from the backend says only "Validation failed"; the reason is in
 * `details` as `[{ field, message }]`. Showing the bare headline leaves the
 * operator guessing which field the server objected to, so the per-field
 * messages are appended.
 */
function describeFailure(envelope: ApiEnvelope<unknown> | null, status: number): string {
  const headline = envelope?.error?.message ?? `Request failed with status ${status}`;
  const details = envelope?.error?.details;

  if (!Array.isArray(details)) return headline;

  const reasons = details
    .map((d) => (d && typeof d.message === 'string' ? d.message : null))
    .filter((m): m is string => Boolean(m));

  return reasons.length ? `${headline}: ${reasons.join(' ')}` : headline;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, skipAuthRedirect = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    // fetch only rejects on network-level failure, so the server is
    // unreachable rather than unhappy — say so plainly.
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      clearToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(
      describeFailure(envelope, response.status),
      response.status,
      envelope?.error?.details
    );
  }

  if (!envelope?.success) {
    throw new ApiError(envelope?.error?.message ?? 'Unexpected response from server', 500);
  }

  return envelope.data as T;
}
