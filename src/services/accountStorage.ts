import { ManagedAccount } from '../types/nuvio';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from './supabaseClient';
import { makeId } from './randomId';

const STORAGE_KEY = 'nuvio_managed_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'nuvio_active_account_id_v1';

export function loadAccounts(): ManagedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load accounts from storage', e);
    return [];
  }
}

export function saveAccounts(accounts: ManagedAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts to storage', e);
  }
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function setActiveAccountId(id: string) {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
}

export function clearActiveAccountId(): void {
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

export function createDefaultAccount(partial: Partial<ManagedAccount>): ManagedAccount {
  return {
    id: makeId(),
    name: partial.name || 'New Device Account',
    email: partial.email || '',
    region: partial.region || '',
    notes: partial.notes || '',
    supabaseUrl: partial.supabaseUrl || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: partial.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY,
    activeProfileId: partial.activeProfileId ?? 1,
    profiles: partial.profiles || [{ id: 1, name: 'Default', isPrimary: true }],
    ...partial,
  };
}
