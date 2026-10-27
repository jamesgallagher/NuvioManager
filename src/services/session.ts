import { SupabaseClient } from '@supabase/supabase-js';
import { ManagedAccount } from '../types/nuvio';
import { getSupabaseClient, evictClients } from './supabaseClient';

/**
 * Thrown when a session has expired and cannot be refreshed.
 */
export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired. Sign in again.');
    this.name = 'AuthExpiredError';
  }
}

/**
 * True for errors that indicate an expired/invalid session.
 */
export function isAuthError(err: unknown): boolean {
  const messageMatch = (msg: unknown): boolean =>
    typeof msg === 'string' && /jwt expired|invalid jwt|not authenticated/i.test(msg);
  if (typeof err === 'string') {
    return messageMatch(err);
  }
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.status === 401) return true;
    if (e.code === 'PGRST301') return true;
    if (messageMatch(e.message)) return true;
  }
  return false;
}

/**
 * Local helper for now; replaced by services/clientFor.ts in 5.6.
 */
function clientFor(account: ManagedAccount): SupabaseClient {
  return getSupabaseClient(account.supabaseUrl, account.supabaseAnonKey, account.accessToken);
}

/**
 * Run a remote call with automatic session refresh. If the call fails with an
 * auth error and the account has a refresh token, refresh the session once and
 * retry the call once. Non-auth errors pass through untouched.
 */
export async function withSession<T>(
  account: ManagedAccount,
  fn: (client: SupabaseClient) => Promise<T>,
  onAccountUpdated: (a: ManagedAccount) => void
): Promise<T> {
  try {
    return await fn(clientFor(account));
  } catch (err) {
    if (!isAuthError(err)) {
      throw err;
    }
    if (!account.refreshToken) {
      throw new AuthExpiredError();
    }
    let refreshed: ManagedAccount;
    try {
      const unAuthClient = getSupabaseClient(account.supabaseUrl, account.supabaseAnonKey);
      const { data, error } = await unAuthClient.auth.refreshSession({
        refresh_token: account.refreshToken,
      });
      if (error || !data.session) {
        // eslint-disable-next-line preserve-caught-error -- validation failure, not a re-throw of a caught error
        throw new Error('refresh failed');
      }
      refreshed = {
        ...account,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    } catch (refreshErr) {
      const e = new AuthExpiredError();
      (e as { cause?: unknown }).cause = refreshErr;
      throw e;
    }
    onAccountUpdated(refreshed);
    evictClients(account.supabaseUrl);
    try {
      return await fn(clientFor(refreshed));
    } catch (retryErr) {
      if (isAuthError(retryErr)) {
        throw new AuthExpiredError();
      }
      throw retryErr;
    }
  }
}
