export interface GoTrueSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: Record<string, any> | null;
}

interface GoTrueTokenResponse {
  status?: string;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: Record<string, any>;
  [key: string]: any;
}

const ACCESS_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'authRefreshToken';
const EXPIRES_AT_KEY = 'authExpiresAt';
const USER_DATA_KEY = 'userData';
export const AUTH_SESSION_CHANGED_EVENT = 'gotrue-auth-session-changed';

let refreshUrl = '';
let logoutUrl = '';
let refreshInFlight: Promise<GoTrueSession | null> | null = null;

export function configureAuthSession(config: { refreshUrl: string; logoutUrl?: string }): void {
  refreshUrl = config.refreshUrl;
  logoutUrl = config.logoutUrl ?? '';
}

function decodeJwtExpiry(token: string): number | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function notifySessionChanged(): void {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function getStoredSession(): GoTrueSession | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
  if (!accessToken && !refreshToken) return null;

  const storedExpiry = Number(localStorage.getItem(EXPIRES_AT_KEY));
  const userData = localStorage.getItem(USER_DATA_KEY);
  let user: Record<string, any> | null = null;
  try {
    user = userData ? JSON.parse(userData) : null;
  } catch {
    localStorage.removeItem(USER_DATA_KEY);
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(storedExpiry) && storedExpiry > 0 ? storedExpiry : decodeJwtExpiry(accessToken),
    user,
  };
}

export function storeGoTrueSession(response: GoTrueTokenResponse): GoTrueSession {
  const accessToken = String(response.access_token ?? response.token ?? '').trim();
  const existing = getStoredSession();
  const refreshToken = String(response.refresh_token ?? existing?.refreshToken ?? '').trim();
  if (!accessToken || !refreshToken) throw new Error('GoTrue did not return a complete token pair');

  const expiresAt = typeof response.expires_at === 'number'
    ? response.expires_at
    : typeof response.expires_in === 'number'
      ? Math.floor(Date.now() / 1000) + response.expires_in
      : decodeJwtExpiry(accessToken);
  const responseUser = response.user ?? response;
  const userMetadata = responseUser?.user_metadata ?? responseUser?.raw_user_meta_data ?? {};
  const user = {
    ...responseUser,
    email: responseUser?.email ?? response.email,
    username: responseUser?.username ?? response.username ?? responseUser?.email ?? response.email,
    full_name:
      responseUser?.full_name ??
      response.full_name ??
      userMetadata.full_name ??
      userMetadata.employee_name,
    employee_name:
      responseUser?.employee_name ??
      response.employee_name ??
      userMetadata.employee_name ??
      userMetadata.full_name,
    user_metadata: userMetadata,
  };

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (expiresAt) localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  notifySessionChanged();

  return { accessToken, refreshToken, expiresAt, user };
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  notifySessionChanged();
}

export function getAccessToken(): string {
  return getStoredSession()?.accessToken ?? '';
}

export function accessTokenNeedsRefresh(leewaySeconds = 60): boolean {
  const session = getStoredSession();
  if (!session?.accessToken) return true;
  if (!session.expiresAt) return false;
  return session.expiresAt <= Math.floor(Date.now() / 1000) + leewaySeconds;
}

export async function refreshAuthSession(force = false): Promise<GoTrueSession | null> {
  const current = getStoredSession();
  if (!current?.refreshToken || !refreshUrl) return null;
  if (!force && !accessTokenNeedsRefresh()) return current;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });
    if (!response.ok) {
      clearAuthSession();
      return null;
    }
    const data = await response.json() as GoTrueTokenResponse | GoTrueTokenResponse[];
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.status !== 'success' || !(result.access_token ?? result.token)) {
      clearAuthSession();
      return null;
    }
    return storeGoTrueSession(result);
  })().catch(() => {
    clearAuthSession();
    return null;
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  await refreshAuthSession(false);

  const perform = () => {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) {
      headers.set('Token', token);
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  };

  let response = await perform();
  if (response.status === 401 && await refreshAuthSession(true)) response = await perform();
  return response;
}

export async function logoutAuthSession(): Promise<void> {
  const token = getAccessToken();
  if (token && logoutUrl) {
    try {
      await fetch(logoutUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Local logout must still succeed if the network is unavailable.
    }
  }
  clearAuthSession();
}
