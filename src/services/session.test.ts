import { describe, it, expect, afterEach, vi } from 'vitest';
import { withSession, isAuthError, AuthExpiredError } from './session';
import { getSupabaseClient, evictClients } from './supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import { ManagedAccount } from '../types/nuvio';

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: vi.fn(),
  evictClients: vi.fn(),
}));

type MockClient = {
  rpc: ReturnType<typeof vi.fn>;
  auth: { refreshSession: ReturnType<typeof vi.fn> };
};

function makeMockClient(): MockClient {
  return {
    rpc: vi.fn(),
    auth: { refreshSession: vi.fn() },
  };
}

// Wrap a mock rpc call in a Promise so it matches the (client) => Promise<T> signature.
function rpcPromise(c: SupabaseClient, method: string): Promise<unknown> {
  return Promise.resolve(c.rpc(method) as unknown);
}

const baseAccount: ManagedAccount = {
  id: 'acc1',
  name: 'Test Account',
  email: 'test@example.invalid',
  supabaseUrl: 'https://example.invalid',
  supabaseAnonKey: 'test-anon-key',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  activeProfileId: 1,
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('isAuthError', () => {
  it('true for {status:401}', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it('true for {code:PGRST301}', () => {
    expect(isAuthError({ code: 'PGRST301' })).toBe(true);
  });

  it('true for new Error(JWT expired)', () => {
    expect(isAuthError(new Error('JWT expired'))).toBe(true);
  });

  it('false for a 500', () => {
    expect(isAuthError({ status: 500 })).toBe(false);
  });

  it('false for a plain network error', () => {
    expect(isAuthError(new Error('Network error'))).toBe(false);
  });

  it('false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });

  it('false for a plain string', () => {
    expect(isAuthError('not an auth error')).toBe(false);
  });
});

describe('withSession', () => {
  it('success passes through', async () => {
    const authClient = makeMockClient();
    authClient.rpc.mockResolvedValue('result');
    vi.mocked(getSupabaseClient).mockImplementation((_url, _key, _token) => {
      return authClient as unknown as SupabaseClient;
    });
    const result = await withSession(baseAccount, (c) => rpcPromise(c, 'test'), vi.fn());
    expect(result).toBe('result');
  });

  it('non-auth error passes through with no refresh attempt', async () => {
    const authClient = makeMockClient();
    authClient.rpc.mockRejectedValue(new Error('network error'));
    vi.mocked(getSupabaseClient).mockImplementation(() => authClient as unknown as SupabaseClient);
    await expect(withSession(baseAccount, (c) => rpcPromise(c, 'test'), vi.fn())).rejects.toThrow(/network error/);
    expect(authClient.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('auth error + refresh token -> refresh called once, onAccountUpdated called, retry called once', async () => {
    const authClient = makeMockClient();
    const unAuthClient = makeMockClient();
    authClient.rpc
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce('retry result');
    unAuthClient.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token', refresh_token: 'new-refresh' } },
      error: null,
    });
    vi.mocked(getSupabaseClient).mockImplementation((_url, _key, token) => {
      return (token ? authClient : unAuthClient) as unknown as SupabaseClient;
    });
    const onAccountUpdated = vi.fn();
    const result = await withSession(baseAccount, (c) => rpcPromise(c, 'test'), onAccountUpdated);
    expect(result).toBe('retry result');
    expect(unAuthClient.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(onAccountUpdated).toHaveBeenCalledWith({
      ...baseAccount,
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    });
    expect(evictClients).toHaveBeenCalledWith(baseAccount.supabaseUrl);
  });

  it('refresh fails -> AuthExpiredError', async () => {
    const authClient = makeMockClient();
    const unAuthClient = makeMockClient();
    authClient.rpc.mockRejectedValueOnce({ status: 401 });
    unAuthClient.auth.refreshSession.mockResolvedValue({ data: null, error: new Error('refresh error') });
    vi.mocked(getSupabaseClient).mockImplementation((_url, _key, token) => {
      return (token ? authClient : unAuthClient) as unknown as SupabaseClient;
    });
    await expect(withSession(baseAccount, (c) => rpcPromise(c, 'test'), vi.fn())).rejects.toThrow(AuthExpiredError);
  });

  it('no refresh token -> AuthExpiredError with no refresh call', async () => {
    const authClient = makeMockClient();
    const unAuthClient = makeMockClient();
    authClient.rpc.mockRejectedValueOnce({ status: 401 });
    vi.mocked(getSupabaseClient).mockImplementation((_url, _key, token) => {
      return (token ? authClient : unAuthClient) as unknown as SupabaseClient;
    });
    const account = { ...baseAccount, refreshToken: undefined };
    await expect(withSession(account, (c) => rpcPromise(c, 'test'), vi.fn())).rejects.toThrow(AuthExpiredError);
    expect(unAuthClient.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('retry fails with auth error -> AuthExpiredError and exactly 2 calls to fn', async () => {
    const authClient = makeMockClient();
    const unAuthClient = makeMockClient();
    authClient.rpc
      .mockRejectedValueOnce({ status: 401 })
      .mockRejectedValueOnce({ status: 401 });
    unAuthClient.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token', refresh_token: 'new-refresh' } },
      error: null,
    });
    vi.mocked(getSupabaseClient).mockImplementation((_url, _key, token) => {
      return (token ? authClient : unAuthClient) as unknown as SupabaseClient;
    });
    await expect(withSession(baseAccount, (c) => rpcPromise(c, 'test'), vi.fn())).rejects.toThrow(AuthExpiredError);
    expect(authClient.rpc).toHaveBeenCalledTimes(2);
  });
});
