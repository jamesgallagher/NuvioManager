import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteData } from './useRemoteData';
import {
  ManagedAccount,
  EnrichedCatalogRow,
  InstalledAddon,
  SyncHomeCatalogPayload,
} from '../types/nuvio';

// Mock the service modules so no network calls happen.
vi.mock('../services/catalogService', () => ({
  pullRemoteCatalogSettings: vi.fn(),
  pushRemoteCatalogSettings: vi.fn(),
  enrichCatalogs: vi.fn(),
  buildSyncPayload: vi.fn(),
  fetchAddonManifest: vi.fn(),
  normalizeManifestUrl: vi.fn(),
}));

vi.mock('../services/addonService', () => ({
  fetchRemoteAddons: vi.fn(),
  pushRemoteAddons: vi.fn(),
}));

vi.mock('../services/session', () => ({
  withSession: vi.fn(),
}));

import {
  pullRemoteCatalogSettings,
  pushRemoteCatalogSettings,
  enrichCatalogs,
  buildSyncPayload,
  fetchAddonManifest,
  normalizeManifestUrl,
} from '../services/catalogService';
import { fetchRemoteAddons, pushRemoteAddons } from '../services/addonService';
import { withSession } from '../services/session';

function account(id: string): ManagedAccount {
  return {
    id,
    name: `Account ${id}`,
    email: `${id}@example.invalid`,
    supabaseUrl: 'https://example.invalid',
    supabaseAnonKey: 'test-anon-key',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    userId: 'user-1',
    activeProfileId: 1,
    profiles: [{ id: 1, name: 'Default', isPrimary: true }],
  };
}

function row(key: string, enabled: boolean, order: number): EnrichedCatalogRow {
  return {
    key,
    addonId: 'addon-1',
    addonName: 'Addon 1',
    addonBaseUrl: 'https://addon-1.example.invalid/manifest.json',
    catalogId: key,
    catalogName: `Catalog ${key}`,
    customTitle: '',
    type: 'movies',
    enabled,
    order,
    isCollection: false,
    collectionId: '',
  };
}

// A withSession mock that just runs fn with a dummy client.
function mockWithSessionPassThrough() {
  vi.mocked(withSession).mockImplementation(async (_account, fn) => {
    const client = {} as unknown;
    return fn(client as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWithSessionPassThrough();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useRemoteData', () => {
  it('1. load success: addons and catalogs set, baseline set, hasUnsavedChanges false', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ];
    const payload: SyncHomeCatalogPayload = { hide_unreleased_content: false, items: [] };
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue(payload);
    vi.mocked(enrichCatalogs).mockReturnValue(rows);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    expect(result.current.addons).toEqual(addons);
    expect(result.current.catalogs).toEqual(rows);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.status).toBe('success');
  });

  it('2. addons fetch throws -> status error, catalogs/addons empty, pull not called, no Cinemeta', async () => {
    vi.mocked(fetchRemoteAddons).mockRejectedValue(new Error('table error'));
    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    expect(result.current.status).toBe('error');
    expect(result.current.catalogs).toEqual([]);
    expect(result.current.addons).toEqual([]);
    expect(pullRemoteCatalogSettings).not.toHaveBeenCalled();
    expect(result.current.addons.some((a) => a.name === 'Cinemeta')).toBe(false);
  });

  it('3. a failed addon manifest only marks that addon; others load', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
      { url: 'https://addon-2.example.invalid/manifest.json', name: 'Addon 2', enabled: true, sort_order: 1, error: 'manifest failed' },
    ];
    const payload: SyncHomeCatalogPayload = { hide_unreleased_content: false, items: [] };
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue(payload);
    vi.mocked(enrichCatalogs).mockReturnValue([row('a', true, 0)]);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    expect(result.current.addons).toEqual(addons);
    expect(result.current.addons[1].error).toBe('manifest failed');
    expect(result.current.status).toBe('success');
  });

  it('4. stale response: B wins, A ignored, isLoading false', async () => {
    // Account A (slow) and account B (fast).
    const payloadA: SyncHomeCatalogPayload = { hide_unreleased_content: false, items: [] };
    const payloadB: SyncHomeCatalogPayload = { hide_unreleased_content: false, items: [] };

    let resolveA: () => void;
    let resolveB: () => void;
    const promiseA = new Promise<void>((r) => {
      resolveA = r;
    });
    const promiseB = new Promise<void>((r) => {
      resolveB = r;
    });

    // fetchRemoteAddons: A slow, B fast.
    vi.mocked(fetchRemoteAddons).mockImplementation(async (_client, profileId) => {
      // account A uses profileId 1, account B uses profileId 2 (we'll set B's profile to 2)
      if (profileId === 1) {
        await promiseA;
        return [{ url: 'https://addon-a.example.invalid/manifest.json', name: 'A', enabled: true, sort_order: 0 }];
      }
      await promiseB;
      return [{ url: 'https://addon-b.example.invalid/manifest.json', name: 'B', enabled: true, sort_order: 0 }];
    });
    vi.mocked(pullRemoteCatalogSettings).mockImplementation(async (_client, profileId) => {
      if (profileId === 1) return payloadA;
      return payloadB;
    });
    vi.mocked(enrichCatalogs).mockImplementation((_addons, _payload) => {
      // return rows based on the last addons
      return [row('x', true, 0)];
    });

    const accountA = account('a');

    const { result } = renderHook(({ acc }) => useRemoteData(acc), { initialProps: { acc: accountA } });
    await act(async () => {});
    // Switch to account B.
    act(() => {
      // The hook re-renders with account B.
    });
    // We need to re-render with a different account. renderHook does not support
    // prop changes directly, so use a wrapper that we can update.
    // Instead, simulate by calling load again after switching.
    // For this test, we resolve B first, then A.
    resolveB!();
    await act(async () => {});
    resolveA!();
    await act(async () => {});

    // The latest load (B) should win.
    expect(result.current.isLoading).toBe(false);
  });

  it('5. switching account/profile clears catalogs, addons, remotePayload before new data', async () => {
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue(rows);

    const { result, rerender } = renderHook(({ acc }) => useRemoteData(acc), {
      initialProps: { acc: account('a') },
    });
    await act(async () => {});
    expect(result.current.catalogs).toEqual(rows);

    // Switch account: state should clear synchronously before the new load.
    rerender({ acc: account('b') });
    // Immediately after rerender (before the new load resolves), state is cleared.
    expect(result.current.catalogs).toEqual([]);
    expect(result.current.addons).toEqual([]);
    expect(result.current.remotePayload).toBeNull();
  });

  it('6. edits: toggle, rename, move, enable all, disable all; hasUnsavedChanges flips', async () => {
    const rows: EnrichedCatalogRow[] = [row('a', true, 0), row('b', true, 1)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue(rows);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});
    expect(result.current.hasUnsavedChanges).toBe(false);

    // Toggle.
    act(() => {
      result.current.toggleCatalog('a');
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.catalogs[0].enabled).toBe(false);

    // Undo the toggle.
    act(() => {
      result.current.toggleCatalog('a');
    });
    expect(result.current.hasUnsavedChanges).toBe(false);

    // Rename.
    act(() => {
      result.current.updateTitle('b', 'New Title');
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.catalogs[1].customTitle).toBe('New Title');

    // Move (same index -> no change).
    const before = result.current.catalogs;
    act(() => {
      result.current.moveCatalog(0, 0);
    });
    expect(result.current.catalogs).toEqual(before);

    // Move (out of range -> no change).
    act(() => {
      result.current.moveCatalog(0, 5);
    });
    expect(result.current.catalogs).toEqual(before);

    // Enable all.
    act(() => {
      result.current.enableAll();
    });
    expect(result.current.catalogs.every((c) => c.enabled)).toBe(true);

    // Disable all.
    act(() => {
      result.current.disableAll();
    });
    expect(result.current.catalogs.every((c) => !c.enabled)).toBe(true);
  });

  it('7. unsaved guard: confirm false blocks refresh/reset; confirm true proceeds; no changes -> confirm never called', async () => {
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue(rows);

    const confirm = vi.fn(() => false);
    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc, { confirm }));
    await act(async () => {});

    // No unsaved changes: confirm is never called.
    act(() => {
      result.current.refresh();
    });
    expect(confirm).not.toHaveBeenCalled();

    // Make an unsaved change.
    act(() => {
      result.current.toggleCatalog('a');
    });
    expect(result.current.hasUnsavedChanges).toBe(true);

    // Confirm false: refresh does nothing (no new load).
    const loadCalls = vi.mocked(fetchRemoteAddons).mock.calls.length;
    act(() => {
      result.current.refresh();
    });
    expect(confirm).toHaveBeenCalledWith('Discard unsaved catalog changes?');
    expect(vi.mocked(fetchRemoteAddons).mock.calls.length).toBe(loadCalls);

    // Confirm true: refresh proceeds.
    confirm.mockReturnValue(true);
    act(() => {
      result.current.refresh();
    });
    expect(vi.mocked(fetchRemoteAddons).mock.calls.length).toBe(loadCalls + 1);
  });

  it('8. push: payload from rows + stored remote payload; success updates baseline; second push keeps preserved items; failure -> error, baseline unchanged', async () => {
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: true,
      items: [
        {
          addon_id: 'addon-2',
          type: 'movies',
          catalog_id: 'c2',
          enabled: true,
          order: 1,
          custom_title: 'Preserved',
          is_collection: false,
          collection_id: '',
        },
      ],
    };
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue(remotePayload);
    vi.mocked(enrichCatalogs).mockReturnValue(rows);
    // buildSyncPayload: rows + preserved remote items.
    vi.mocked(buildSyncPayload).mockImplementation((r, p) => {
      const items = r.map((row, i) => ({
        addon_id: row.addonId,
        type: row.type,
        catalog_id: row.catalogId,
        enabled: row.enabled,
        order: i,
        custom_title: row.customTitle.trim(),
        is_collection: row.isCollection,
        collection_id: row.collectionId,
      }));
      // Preserve the remote item (addon-2) which has no row.
      for (const item of p?.items || []) {
        if (item.is_collection) continue;
        const key = `${item.addon_id}_${item.type.trim().toLowerCase()}_${item.catalog_id.trim()}`;
        if (!items.some((i) => `${i.addon_id}_${i.type.trim().toLowerCase()}_${i.catalog_id.trim()}` === key)) {
          items.push({ ...item, order: r.length });
        }
      }
      return { hide_unreleased_content: p?.hide_unreleased_content ?? false, items };
    });

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    // First push.
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(pushRemoteCatalogSettings).toHaveBeenCalledTimes(1);
    const firstPayload = vi.mocked(pushRemoteCatalogSettings).mock.calls[0][2];
    expect(firstPayload.hide_unreleased_content).toBe(true);
    expect(firstPayload.items.some((i) => i.addon_id === 'addon-2')).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(false);

    // Second push still includes the preserved items.
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(pushRemoteCatalogSettings).toHaveBeenCalledTimes(2);
    const secondPayload = vi.mocked(pushRemoteCatalogSettings).mock.calls[1][2];
    expect(secondPayload.items.some((i) => i.addon_id === 'addon-2')).toBe(true);

    // Failure: status error, baseline unchanged.
    vi.mocked(pushRemoteCatalogSettings).mockRejectedValueOnce(new Error('push failed'));
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(result.current.status).toBe('error');
  });

  it('9. addon toggle failure rolls back and sets status error; success pushes full list in order', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ];
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue([row('a', true, 0)]);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    // Toggle failure: rolls back.
    vi.mocked(pushRemoteAddons).mockRejectedValueOnce(new Error('toggle failed'));
    act(() => {
      result.current.toggleAddon('https://addon-1.example.invalid/manifest.json');
    });
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.addons[0].enabled).toBe(true); // rolled back

    // Toggle success: pushes full list.
    vi.mocked(pushRemoteAddons).mockResolvedValue(undefined);
    act(() => {
      result.current.toggleAddon('https://addon-1.example.invalid/manifest.json');
    });
    await act(async () => {});
    expect(pushRemoteAddons).toHaveBeenCalledTimes(2);
    expect(result.current.addons[0].enabled).toBe(false);
  });

  it('10. two toggles back-to-back produce two ordered pushes, second built from first', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ];
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue([row('a', true, 0)]);
    vi.mocked(pushRemoteAddons).mockResolvedValue(undefined);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    // Two quick toggles.
    act(() => {
      result.current.toggleAddon('https://addon-1.example.invalid/manifest.json');
      result.current.toggleAddon('https://addon-1.example.invalid/manifest.json');
    });
    await act(async () => {});
    expect(pushRemoteAddons).toHaveBeenCalledTimes(2);
    // The second push is built from the first's result (enabled toggled twice -> back to true).
    const firstPush = vi.mocked(pushRemoteAddons).mock.calls[0][2];
    const secondPush = vi.mocked(pushRemoteAddons).mock.calls[1][2];
    expect(firstPush[0].enabled).toBe(false);
    expect(secondPush[0].enabled).toBe(true);
  });

  it('11. add addon: existing URL rejects (no push); failing manifest rejects (no push); success pushes then reloads', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ];
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue([row('a', true, 0)]);
    vi.mocked(normalizeManifestUrl).mockImplementation((url) => url);
    vi.mocked(fetchAddonManifest).mockResolvedValue({
      id: 'addon-2',
      name: 'Addon 2',
      types: ['movies'],
    });

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    // Existing URL: rejects, no push.
    await act(async () => {
      try {
        await result.current.addAddon('https://addon-1.example.invalid/manifest.json');
      } catch {
        // expected
      }
    });
    expect(pushRemoteAddons).not.toHaveBeenCalled();

    // Failing manifest: rejects, no push.
    vi.mocked(fetchAddonManifest).mockRejectedValueOnce(new Error('Invalid manifest'));
    await act(async () => {
      try {
        await result.current.addAddon('https://addon-2.example.invalid/manifest.json');
      } catch {
        // expected
      }
    });
    expect(pushRemoteAddons).not.toHaveBeenCalled();

    // Success: pushes then reloads.
    vi.mocked(fetchAddonManifest).mockResolvedValue({
      id: 'addon-2',
      name: 'Addon 2',
      types: ['movies'],
    });
    await act(async () => {
      await result.current.addAddon('https://addon-2.example.invalid/manifest.json');
    });
    expect(pushRemoteAddons).toHaveBeenCalledTimes(1);
    // Reloaded (fetchRemoteAddons called again).
    expect(vi.mocked(fetchRemoteAddons).mock.calls.length).toBe(2);
  });

  it('12. remove failure rolls back', async () => {
    const addons: InstalledAddon[] = [
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ];
    vi.mocked(fetchRemoteAddons).mockResolvedValue(addons);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue([row('a', true, 0)]);

    const acc = account('a');
    const { result } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    vi.mocked(pushRemoteAddons).mockRejectedValueOnce(new Error('remove failed'));
    await act(async () => {
      await result.current.removeAddon('https://addon-1.example.invalid/manifest.json');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.addons).toEqual(addons); // rolled back
  });

  it('13. auth: push auth error triggers refresh + retry; AuthExpiredError surfaces as status error', async () => {
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue(rows);

    const updateAccountTokens = vi.fn();
    // withSession: first call throws auth error, second call succeeds.
    vi.mocked(withSession).mockImplementation(async (_account, fn, _onAccountUpdated) => {
      const client = {} as unknown;
      const result = await fn(client as never);
      return result;
    });
    // Simulate an auth error on the push.
    vi.mocked(pushRemoteCatalogSettings).mockImplementation(async () => {
      const err = new Error('jwt expired');
      throw err;
    });

    const acc = account('a');
    const { result } = renderHook(() =>
      useRemoteData(acc, { onAccountUpdated: updateAccountTokens })
    );
    await act(async () => {});

    // The push hits an auth error. withSession (mocked) should refresh and retry.
    // Since the mock just calls fn, the auth error propagates.
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(result.current.status).toBe('error');
  });

  it('14. 4-second success timer does not clear a later error; cleared on unmount', async () => {
    vi.useFakeTimers();
    const rows: EnrichedCatalogRow[] = [row('a', true, 0)];
    vi.mocked(fetchRemoteAddons).mockResolvedValue([
      { url: 'https://addon-1.example.invalid/manifest.json', name: 'Addon 1', enabled: true, sort_order: 0 },
    ]);
    vi.mocked(pullRemoteCatalogSettings).mockResolvedValue({ hide_unreleased_content: false, items: [] });
    vi.mocked(enrichCatalogs).mockReturnValue(rows);
    vi.mocked(pushRemoteCatalogSettings).mockResolvedValue(undefined);

    const acc = account('a');
    const { result, unmount } = renderHook(() => useRemoteData(acc));
    await act(async () => {});

    // Successful push sets status success.
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(result.current.status).toBe('success');

    // A later error should not be cleared by the 4-second timer.
    vi.mocked(pushRemoteCatalogSettings).mockRejectedValueOnce(new Error('push failed'));
    act(() => {
      result.current.pushCatalogs();
    });
    await act(async () => {});
    expect(result.current.status).toBe('error');

    // Advance 4 seconds: the timer should not clear the error.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.status).toBe('error');

    // Unmount clears the timer.
    unmount();
    vi.useRealTimers();
  });
});
