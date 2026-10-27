import { useState, useEffect, useCallback, useRef } from 'react';
import { ManagedAccount } from '../types/nuvio';
import {
  loadAccounts,
  saveAccounts,
  getActiveAccountId,
  setActiveAccountId,
} from '../services/accountStorage';

export interface UseAccountsResult {
  accounts: ManagedAccount[];
  activeAccount: ManagedAccount | null;
  selectAccount: (id: string) => void;
  selectProfile: (profileId: number) => void;
  saveAccount: (account: ManagedAccount) => void;
  deleteAccount: (id: string) => void;
  updateAccountTokens: (accountId: string, accessToken: string, refreshToken: string) => void;
}

/**
 * Owns the managed accounts list and the active account, persisting every
 * change through accountStorage. Functional updates (and refs for reads)
 * keep the callbacks free of stale `accounts` closures.
 */
export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<ManagedAccount | null>(null);

  // Refs mirror the latest state so callbacks never read a stale closure.
  const accountsRef = useRef<ManagedAccount[]>([]);
  accountsRef.current = accounts;
  const activeAccountRef = useRef<ManagedAccount | null>(null);
  activeAccountRef.current = activeAccount;

  // Initialize from storage on mount.
  useEffect(() => {
    const loaded = loadAccounts();
    setAccounts(loaded);
    const activeId = getActiveAccountId();
    const current = loaded.find((a) => a.id === activeId) || (loaded.length > 0 ? loaded[0] : null);
    setActiveAccount(current);
  }, []);

  const selectAccount = useCallback((id: string) => {
    const acc = accountsRef.current.find((a) => a.id === id);
    if (acc) {
      setActiveAccount(acc);
      setActiveAccountId(acc.id);
    }
  }, []);

  const selectProfile = useCallback((profileId: number) => {
    const active = activeAccountRef.current;
    if (!active) return;
    const updated = { ...active, activeProfileId: profileId };
    setActiveAccount(updated);
    setAccounts((prev) => {
      const next = prev.map((a) => (a.id === updated.id ? updated : a));
      saveAccounts(next);
      return next;
    });
  }, []);

  const saveAccount = useCallback((account: ManagedAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === account.id);
      const next = exists
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account];
      saveAccounts(next);
      return next;
    });
    setActiveAccount(account);
  }, []);

  const deleteAccount = useCallback((id: string) => {
    const remaining = accountsRef.current.filter((a) => a.id !== id);
    saveAccounts(remaining);
    setAccounts(remaining);
    const active = activeAccountRef.current;
    if (active?.id === id) {
      setActiveAccount(remaining[0] || null);
    }
  }, []);

  const updateAccountTokens = useCallback(
    (accountId: string, accessToken: string, refreshToken: string) => {
      const next = accountsRef.current.map((a) =>
        a.id === accountId ? { ...a, accessToken, refreshToken } : a
      );
      saveAccounts(next);
      setAccounts(next);
      const active = activeAccountRef.current;
      if (active?.id === accountId) {
        setActiveAccount({ ...active, accessToken, refreshToken });
      }
    },
    []
  );

  return {
    accounts,
    activeAccount,
    selectAccount,
    selectProfile,
    saveAccount,
    deleteAccount,
    updateAccountTokens,
  };
}
