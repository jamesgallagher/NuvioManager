import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  EnrichedCatalogRow,
  InstalledAddon,
  ManagedAccount,
  SyncHomeCatalogPayload,
  UserProfile,
} from '../types/nuvio';
import {
  pullRemoteCatalogSettings,
  pushRemoteCatalogSettings,
  enrichCatalogs,
  buildSyncPayload,
  fetchAddonManifest,
  normalizeManifestUrl,
} from '../services/catalogService';
import { fetchRemoteAddons, pushRemoteAddons } from '../services/addonService';
import { catalogSignature } from '../services/catalogSignature';
import { toErrorMessage } from '../services/errors';
import { withSession } from '../services/session';
import { pullProfiles } from '../services/profileService';

export type RemoteStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface UseRemoteDataOptions {
  confirm?: (message: string) => boolean;
  /**
   * Called when withSession refreshes the account's tokens. App wires this
   * to useAccounts' updateAccountTokens.
   */
  onAccountUpdated?: (account: ManagedAccount) => void;
  /** Called with the account's profiles as the server reports them. */
  onProfilesLoaded?: (accountId: string, profiles: UserProfile[]) => void;
}

export interface UseRemoteDataResult {
  catalogs: EnrichedCatalogRow[];
  addons: InstalledAddon[];
  remotePayload: SyncHomeCatalogPayload | null;
  baselineSignature: string;
  isLoading: boolean;
  isSaving: boolean;
  status: RemoteStatus;
  statusMessage: string;
  load: () => Promise<void>;
  refresh: () => void;
  pushCatalogs: () => Promise<void>;
  addAddon: (url: string) => Promise<void>;
  toggleAddon: (url: string) => Promise<void>;
  removeAddon: (url: string) => Promise<void>;
  moveCatalog: (fromIndex: number, toIndex: number) => void;
  toggleCatalog: (key: string) => void;
  updateTitle: (key: string, title: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  hasUnsavedChanges: boolean;
  confirmDiscard: () => boolean;
}

/**
 * Owns the remote data for the active account: catalog rows, installed
 * addons, the pulled remote payload, and the load/save status. The catalog
 * editor operations (move/toggle/title/enable/disable) live here too, since
 * they operate on the `catalogs` state owned by this hook.
 */
export function useRemoteData(
  activeAccount: ManagedAccount | null,
  options: UseRemoteDataOptions = {}
): UseRemoteDataResult {
  const confirmFn = options.confirm || window.confirm;
  // Read through a ref so an unstable callback can never retrigger a load.
  const onProfilesLoadedRef = useRef(options.onProfilesLoaded);
  onProfilesLoadedRef.current = options.onProfilesLoaded;
  const onAccountUpdated = useMemo(
    () => options.onAccountUpdated || (() => {}),
    [options.onAccountUpdated]
  );

  const [catalogs, setCatalogs] = useState<EnrichedCatalogRow[]>([]);
  const [addons, setAddons] = useState<InstalledAddon[]>([]);
  const [remotePayload, setRemotePayload] = useState<SyncHomeCatalogPayload | null>(null);
  const [baselineSignature, setBaselineSignature] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<RemoteStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Refs mirror the latest state so async callbacks never read a stale closure.
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;
  const catalogsRef = useRef(catalogs);
  catalogsRef.current = catalogs;
  const addonsRef = useRef(addons);
  addonsRef.current = addons;
  const remotePayloadRef = useRef(remotePayload);
  remotePayloadRef.current = remotePayload;

  // Called by withSession when a refresh happens. Updates the account ref
  // synchronously so a second remote call in the same load reads the refreshed
  // tokens, not the stale snapshot captured at the start of the call. Also
  // forwards to the App's handler (useAccounts' updateAccountTokens).
  const handleAccountUpdated = useCallback((account: ManagedAccount) => {
    activeAccountRef.current = account;
    onAccountUpdated(account);
  }, [onAccountUpdated]);

  // Stale-response protection: each load call increments this counter.
  const requestIdRef = useRef(0);

  // Serial queue for addon mutations (a promise chain).
  const addonQueueRef = useRef<Promise<void>>(Promise.resolve());

  // 4-second success timer.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasUnsavedChanges =
    baselineSignature !== '' && catalogSignature(catalogs) !== baselineSignature;
  const hasUnsavedChangesRef = useRef(false);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  // Clear the success timer (on unmount and when a new status is set).
  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  // Set a new status and clear any pending success timer first, so a later
  // error is not wiped by the 4-second timer.
  const setStatusWithTimerClear = useCallback(
    (newStatus: RemoteStatus) => {
      clearSuccessTimer();
      setStatus(newStatus);
    },
    [clearSuccessTimer]
  );

  // The unsaved-changes guard. Returns true when it is safe to proceed.
  const confirmDiscard = useCallback((): boolean => {
    if (!hasUnsavedChangesRef.current) return true;
    return confirmFn('Discard unsaved catalog changes?');
  }, [confirmFn]);

  // beforeunload listener while there are unsaved changes.
  useEffect(() => {
    if (hasUnsavedChanges) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handler);
      return () => {
        window.removeEventListener('beforeunload', handler);
      };
    }
  }, [hasUnsavedChanges]);

  // Clear the success timer on unmount.
  useEffect(() => {
    return () => {
      clearSuccessTimer();
    };
  }, [clearSuccessTimer]);

  // After a successful load, refresh the profile list (best effort, not
  // awaited): earlier builds stored the wrong id and profiles can change on
  // the TV. A failure here never affects the loaded data or the status.
  const refreshProfiles = useCallback(
    async (requestId: number) => {
      const account = activeAccountRef.current;
      if (!account) return;
      try {
        const profiles = await withSession(account, (client) => pullProfiles(client), handleAccountUpdated);
        if (requestId !== requestIdRef.current) return; // stale
        if (profiles.length > 0) onProfilesLoadedRef.current?.(account.id, profiles);
      } catch (err) {
        console.warn('Could not refresh profiles', err);
      }
    },
    [handleAccountUpdated]
  );

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setStatusWithTimerClear('idle');
    try {
      const account = activeAccountRef.current;
      if (!account) return;
      const fetchedAddons = await withSession(
        account,
        (client) => fetchRemoteAddons(client, account.activeProfileId, account.userId),
        handleAccountUpdated
      );
      if (requestId !== requestIdRef.current) return; // stale
      setAddons(fetchedAddons);
      // Read the account again: the first call may have refreshed the session,
      // so the second call must use the refreshed tokens, not the stale snapshot.
      const accountAfterAddons = activeAccountRef.current;
      if (!accountAfterAddons) return;
      const payload = await withSession(
        accountAfterAddons,
        (client) => pullRemoteCatalogSettings(client, accountAfterAddons.activeProfileId),
        handleAccountUpdated
      );
      if (requestId !== requestIdRef.current) return; // stale
      setRemotePayload(payload);
      const enriched = enrichCatalogs(fetchedAddons, payload);
      setCatalogs(enriched);
      setBaselineSignature(catalogSignature(enriched));
      setStatusWithTimerClear('success');
      setStatusMessage('Catalogs Loaded');
      void refreshProfiles(requestId);
    } catch (err) {
      if (requestId !== requestIdRef.current) return; // stale
      console.error('Failed to load remote data', err);
      setStatusWithTimerClear('error');
      setStatusMessage(toErrorMessage(err, 'Error fetching from Supabase'));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [handleAccountUpdated, refreshProfiles, setStatusWithTimerClear]);

  // Auto-load when the account id or profile id changes; clear old data first so
  // the loading view shows and the previous account's rows are never visible.
  // Keying on id/profile (not the whole account) means a token refresh or an
  // account edit does not wipe unsaved catalog edits or re-load. The rest of the
  // account is read through activeAccountRef.
  const activeAccountId = activeAccount?.id;
  const activeProfileId = activeAccount?.activeProfileId;
  useEffect(() => {
    if (!activeAccountRef.current) return;
    setCatalogs([]);
    setAddons([]);
    setRemotePayload(null);
    setBaselineSignature('');
    load();
  }, [activeAccountId, activeProfileId, load]);

  // User-triggered load (Refresh / Reset) with the unsaved-changes guard.
  const refresh = useCallback(() => {
    if (!confirmDiscard()) return;
    load();
  }, [confirmDiscard, load]);

  const pushCatalogs = useCallback(async () => {
    const account = activeAccountRef.current;
    if (!account) return;
    setIsSaving(true);
    setStatusWithTimerClear('syncing');
    try {
      const payload = buildSyncPayload(catalogsRef.current, remotePayloadRef.current);
      await withSession(
        account,
        (client) => pushRemoteCatalogSettings(client, account.activeProfileId, payload),
        handleAccountUpdated
      );
      setRemotePayload(payload);
      setBaselineSignature(catalogSignature(catalogsRef.current));
      setStatusWithTimerClear('success');
      setStatusMessage('Pushed to TV successfully!');
      successTimerRef.current = setTimeout(() => {
        setStatus('idle');
        successTimerRef.current = null;
      }, 4000);
    } catch (err) {
      console.error('Failed to push catalog settings:', err);
      setStatusWithTimerClear('error');
      setStatusMessage(toErrorMessage(err, 'Push failed'));
    } finally {
      setIsSaving(false);
    }
  }, [handleAccountUpdated, setStatusWithTimerClear]);

  // Addon mutations run through a single serial queue so two quick actions
  // produce two ordered pushes built from the latest list, never overlapping.
  const addAddon = useCallback(
    (url: string): Promise<void> => {
      const promise = addonQueueRef.current.then(async () => {
        const account = activeAccountRef.current;
        if (!account) return;
        const normalized = normalizeManifestUrl(url);
        const existing = addonsRef.current.find((a) => normalizeManifestUrl(a.url) === normalized);
        if (existing) {
          throw new Error('This addon is already installed');
        }
        const manifest = await fetchAddonManifest(url);
        const previous = addonsRef.current;
        const newAddon: InstalledAddon = {
          url: normalized,
          name: manifest.name,
          enabled: true,
          sort_order: previous.length,
          manifest,
        };
        const updated = [...previous, newAddon];
        setAddons(updated); // optimistic
        try {
          await withSession(
            account,
            (client) => pushRemoteAddons(client, account.activeProfileId, updated),
            handleAccountUpdated
          );
          load();
        } catch (err) {
          setAddons(previous); // rollback
          setStatusWithTimerClear('error');
          setStatusMessage(toErrorMessage(err, 'Failed to add addon'));
        }
      });
      addonQueueRef.current = promise.catch(() => {}); // keep the chain alive
      return promise;
    },
    [load, handleAccountUpdated, setStatusWithTimerClear]
  );

  const toggleAddon = useCallback(
    (url: string): Promise<void> => {
      const promise = addonQueueRef.current.then(async () => {
        const account = activeAccountRef.current;
        if (!account) return;
        const previous = addonsRef.current;
        const updated = previous.map((a) =>
          a.url === url ? { ...a, enabled: !a.enabled } : a
        );
        setAddons(updated); // optimistic
        try {
          await withSession(
            account,
            (client) => pushRemoteAddons(client, account.activeProfileId, updated),
            handleAccountUpdated
          );
        } catch (err) {
          setAddons(previous); // rollback
          setStatusWithTimerClear('error');
          setStatusMessage(toErrorMessage(err, 'Failed to toggle addon'));
        }
      });
      addonQueueRef.current = promise.catch(() => {}); // no unhandled rejection
      return promise;
    },
    [handleAccountUpdated, setStatusWithTimerClear]
  );

  const removeAddon = useCallback(
    (url: string): Promise<void> => {
      const promise = addonQueueRef.current.then(async () => {
        const account = activeAccountRef.current;
        if (!account) return;
        const previous = addonsRef.current;
        const updated = previous.filter((a) => a.url !== url);
        setAddons(updated); // optimistic
        try {
          await withSession(
            account,
            (client) => pushRemoteAddons(client, account.activeProfileId, updated),
            handleAccountUpdated
          );
          load();
        } catch (err) {
          setAddons(previous); // rollback
          setStatusWithTimerClear('error');
          setStatusMessage(toErrorMessage(err, 'Failed to remove addon'));
        }
      });
      addonQueueRef.current = promise.catch(() => {}); // no unhandled rejection
      return promise;
    },
    [load, handleAccountUpdated, setStatusWithTimerClear]
  );

  // Catalog editor operations
  const moveCatalog = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= catalogsRef.current.length) return;
    const updated = [...catalogsRef.current];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    const reindexed = updated.map((item, idx) => ({ ...item, order: idx }));
    setCatalogs(reindexed);
  }, []);

  const toggleCatalog = useCallback((key: string) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c))
    );
  }, []);

  const updateTitle = useCallback((key: string, title: string) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, customTitle: title } : c))
    );
  }, []);

  const enableAll = useCallback(() => {
    setCatalogs((prev) => prev.map((c) => ({ ...c, enabled: true })));
  }, []);

  const disableAll = useCallback(() => {
    setCatalogs((prev) => prev.map((c) => ({ ...c, enabled: false })));
  }, []);

  return {
    catalogs,
    addons,
    remotePayload,
    baselineSignature,
    isLoading,
    isSaving,
    status,
    statusMessage,
    load,
    refresh,
    pushCatalogs,
    addAddon,
    toggleAddon,
    removeAddon,
    moveCatalog,
    toggleCatalog,
    updateTitle,
    enableAll,
    disableAll,
    hasUnsavedChanges,
    confirmDiscard,
  };
}
