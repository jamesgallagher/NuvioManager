import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAccounts, saveAccounts, getActiveAccountId, setActiveAccountId, createDefaultAccount } from './accountStorage';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid-1234',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accountStorage', () => {
  it('load returns [] on empty', () => {
    expect(loadAccounts()).toEqual([]);
  });

  it('load returns [] on invalid JSON', () => {
    localStorage.setItem('nuvio_managed_accounts_v1', 'invalid json');
    expect(loadAccounts()).toEqual([]);
  });

  it('save then load round-trips', () => {
    const accounts = [createDefaultAccount({ name: 'Test Account' })];
    saveAccounts(accounts);
    expect(loadAccounts()).toEqual(accounts);
  });

  it('active id get/set', () => {
    expect(getActiveAccountId()).toBeNull();
    setActiveAccountId('acc1');
    expect(getActiveAccountId()).toBe('acc1');
  });

  it('createDefaultAccount fills defaults and keeps passed values', () => {
    const account = createDefaultAccount({ name: 'Test Account', email: 'test@example.invalid' });
    expect(account.name).toBe('Test Account');
    expect(account.email).toBe('test@example.invalid');
    expect(account.id).toBe('test-uuid-1234');
    expect(account.supabaseUrl).toBeTruthy();
    expect(account.activeProfileId).toBe(1);
    expect(account.profiles).toEqual([{ id: 1, name: 'Default', isPrimary: true }]);
  });
});
