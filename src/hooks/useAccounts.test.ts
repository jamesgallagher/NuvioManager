import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccounts } from './useAccounts';
import { saveAccounts, setActiveAccountId } from '../services/accountStorage';
import { evictClients } from '../services/supabaseClient';
import { ManagedAccount } from '../types/nuvio';

vi.mock('../services/supabaseClient', () => ({
  evictClients: vi.fn(),
}));

function account(id: string, name: string): ManagedAccount {
  return {
    id,
    name,
    email: `${name.toLowerCase()}@example.invalid`,
    supabaseUrl: 'https://example.invalid',
    supabaseAnonKey: 'test-anon-key',
    activeProfileId: 1,
    profiles: [{ id: 1, name: 'Default', isPrimary: true }],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAccounts', () => {
  it('loads accounts and selects the stored active id', () => {
    const a = account('a', 'A');
    const b = account('b', 'B');
    saveAccounts([a, b]);
    setActiveAccountId('b');
    const { result } = renderHook(() => useAccounts());
    act(() => {});
    expect(result.current.accounts).toEqual([a, b]);
    expect(result.current.activeAccount?.id).toBe('b');
  });

  it('selects the first account when no active id is stored', () => {
    const a = account('a', 'A');
    const b = account('b', 'B');
    saveAccounts([a, b]);
    const { result } = renderHook(() => useAccounts());
    act(() => {});
    expect(result.current.activeAccount?.id).toBe('a');
  });

  it('selects none when there are no accounts', () => {
    const { result } = renderHook(() => useAccounts());
    act(() => {});
    expect(result.current.accounts).toEqual([]);
    expect(result.current.activeAccount).toBeNull();
  });

  it('saveAccount adds a new one, replaces an existing one, makes it active and persists the active id', () => {
    const a = account('a', 'A');
    saveAccounts([a]);
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    const b = account('b', 'B');
    act(() => {
      result.current.saveAccount(b);
    });
    expect(result.current.accounts).toEqual([a, b]);
    expect(result.current.activeAccount?.id).toBe('b');
    expect(localStorage.getItem('nuvio_active_account_id_v1')).toBe('b');

    const b2 = { ...b, name: 'B2' };
    act(() => {
      result.current.saveAccount(b2);
    });
    expect(result.current.accounts).toEqual([a, b2]);
    expect(result.current.activeAccount?.id).toBe('b');
  });

  it('two saveAccount calls in one act both survive (no stale closure)', () => {
    const a = account('a', 'A');
    saveAccounts([a]);
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    const b = account('b', 'B');
    const c = account('c', 'C');
    act(() => {
      result.current.saveAccount(b);
      result.current.saveAccount(c);
    });
    expect(result.current.accounts).toEqual([a, b, c]);
    expect(result.current.activeAccount?.id).toBe('c');
  });

  it('selectProfile updates only the active account activeProfileId and persists', () => {
    const a = account('a', 'A');
    const b = account('b', 'B');
    saveAccounts([a, b]);
    setActiveAccountId('a');
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    act(() => {
      result.current.selectProfile(2);
    });
    expect(result.current.activeAccount?.activeProfileId).toBe(2);
    expect(result.current.accounts.find((acc) => acc.id === 'a')?.activeProfileId).toBe(2);
    expect(result.current.accounts.find((acc) => acc.id === 'b')?.activeProfileId).toBe(1);
  });

  it('deleteAccount: removes, evicts clients, selects next and persists its id (no confirm here)', () => {
    const a = account('a', 'A');
    const b = account('b', 'B');
    saveAccounts([a, b]);
    setActiveAccountId('a');
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    act(() => {
      result.current.deleteAccount('a');
    });
    expect(evictClients).toHaveBeenCalledWith('https://example.invalid');
    expect(result.current.accounts).toEqual([b]);
    expect(result.current.activeAccount?.id).toBe('b');
    expect(localStorage.getItem('nuvio_active_account_id_v1')).toBe('b');
  });

  it('deleteAccount: deleting the last account leaves none and clears the stored active id', () => {
    const a = account('a', 'A');
    saveAccounts([a]);
    setActiveAccountId('a');
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    act(() => {
      result.current.deleteAccount('a');
    });
    expect(result.current.accounts).toEqual([]);
    expect(result.current.activeAccount).toBeNull();
    expect(localStorage.getItem('nuvio_active_account_id_v1')).toBeNull();
  });

  it('deleteAccount: deleting a non-active account keeps the active one', () => {
    const a = account('a', 'A');
    const b = account('b', 'B');
    saveAccounts([a, b]);
    setActiveAccountId('a');
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    act(() => {
      result.current.deleteAccount('b');
    });
    expect(result.current.accounts).toEqual([a]);
    expect(result.current.activeAccount?.id).toBe('a');
  });

  it('updateAccountTokens replaces tokens in state and storage', () => {
    const a = account('a', 'A');
    saveAccounts([a]);
    setActiveAccountId('a');
    const { result } = renderHook(() => useAccounts());
    act(() => {});

    act(() => {
      result.current.updateAccountTokens('a', 'new-access-token', 'new-refresh-token');
    });
    expect(result.current.activeAccount?.accessToken).toBe('new-access-token');
    expect(result.current.activeAccount?.refreshToken).toBe('new-refresh-token');
    const stored = JSON.parse(localStorage.getItem('nuvio_managed_accounts_v1')!);
    expect(stored[0].accessToken).toBe('new-access-token');
    expect(stored[0].refreshToken).toBe('new-refresh-token');
  });
});
