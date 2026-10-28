import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteData } from './useRemoteData';
import { ManagedAccount } from '../types/nuvio';

vi.mock('../services/catalogService', () => ({
  pullRemoteCatalogSettings: vi.fn().mockResolvedValue(null),
  pushRemoteCatalogSettings: vi.fn(),
  enrichCatalogs: vi.fn(() => []),
  buildSyncPayload: vi.fn(),
  fetchAddonManifest: vi.fn(),
  normalizeManifestUrl: vi.fn(),
}));
vi.mock('../services/addonService', () => ({
  fetchRemoteAddons: vi.fn().mockResolvedValue([]),
  pushRemoteAddons: vi.fn(),
}));
vi.mock('../services/session', () => ({
  withSession: vi.fn(async (_a: unknown, fn: (c: unknown) => unknown) => fn({})),
}));
vi.mock('../services/profileService', () => ({ pullProfiles: vi.fn() }));

import { pullProfiles } from '../services/profileService';
import { pullRemoteCatalogSettings } from '../services/catalogService';

const acc: ManagedAccount = {
  id: 'a',
  name: 'Acc',
  email: 'a@example.invalid',
  supabaseUrl: 'https://example.invalid',
  supabaseAnonKey: 'test-anon-key',
  accessToken: 'token',
  activeProfileId: 1,
  profiles: [{ id: 1, name: 'Default', isPrimary: true }],
};

describe('useRemoteData profile refresh', () => {
  beforeEach(() => {
    vi.mocked(pullProfiles).mockReset();
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue(null);
  });

  it('reports the profiles the server returns after a successful load', async () => {
    const profiles = [{ id: 1, name: 'Main' }, { id: 2, name: 'Daddo' }];
    vi.mocked(pullProfiles).mockResolvedValue(profiles);
    const onProfilesLoaded = vi.fn();
    renderHook(() => useRemoteData(acc, { onProfilesLoaded }));
    await act(async () => {});
    expect(onProfilesLoaded).toHaveBeenCalledWith('a', profiles);
  });

  it('a failing profile refresh does not affect the load or its status', async () => {
    vi.mocked(pullProfiles).mockRejectedValue(new Error('rpc failed'));
    const onProfilesLoaded = vi.fn();
    const { result } = renderHook(() => useRemoteData(acc, { onProfilesLoaded }));
    await act(async () => {});
    expect(onProfilesLoaded).not.toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(result.current.statusMessage).toBe('Catalogs Loaded');
  });

  it('does not refresh profiles when the load itself fails', async () => {
    vi.mocked(pullRemoteCatalogSettings).mockRejectedValue(new Error('pull failed'));
    renderHook(() => useRemoteData(acc, { onProfilesLoaded: vi.fn() }));
    await act(async () => {});
    expect(pullProfiles).not.toHaveBeenCalled();
  });

  it('ignores an empty profile list', async () => {
    vi.mocked(pullProfiles).mockResolvedValue([]);
    const onProfilesLoaded = vi.fn();
    renderHook(() => useRemoteData(acc, { onProfilesLoaded }));
    await act(async () => {});
    expect(onProfilesLoaded).not.toHaveBeenCalled();
  });
});
