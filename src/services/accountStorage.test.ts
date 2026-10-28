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

describe('loadAccounts repairs profiles saved by earlier builds', () => {
  const UUID = '2aac3849-8c96-4d55-9a16-db407c13b5de';
  const base = {
    id: 'a',
    name: 'Acc',
    email: '',
    supabaseUrl: 'https://example.invalid',
    supabaseAnonKey: 'test-anon-key',
  };

  it('replaces UUID profile ids with the default profile and a numeric active profile', () => {
    localStorage.setItem(
      'nuvio_managed_accounts_v1',
      JSON.stringify([{ ...base, activeProfileId: 1, profiles: [{ id: UUID, name: 'Daddo' }] }])
    );
    const [acc] = loadAccounts();
    expect(acc.profiles).toEqual([{ id: 1, name: 'Default', isPrimary: true }]);
    expect(acc.activeProfileId).toBe(1);
  });

  it('fixes a NaN or missing active profile id and leaves good accounts alone', () => {
    localStorage.setItem(
      'nuvio_managed_accounts_v1',
      JSON.stringify([
        { ...base, id: 'b', activeProfileId: null, profiles: [{ id: 2, name: 'Kid' }] },
        { ...base, id: 'c', activeProfileId: 3, profiles: [{ id: 1, name: 'A' }, { id: 3, name: 'B' }] },
      ])
    );
    const [b, c] = loadAccounts();
    expect(b.activeProfileId).toBe(2);
    expect(c.activeProfileId).toBe(3);
    expect(c.profiles).toHaveLength(2);
  });
});
