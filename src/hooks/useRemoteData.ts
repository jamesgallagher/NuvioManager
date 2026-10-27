import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EnrichedCatalogRow,
  InstalledAddon,
  ManagedAccount,
  SyncHomeCatalogPayload,
} from '../types/nuvio';
import {
  pullRemoteCatalogSettings,
  pushRemoteCatalogSettings,
  enrichCatalogs,
  buildSyncPayload,
  fetchAddonManifest,
} from '../services/catalogService';
import { fetchRemoteAddons, pushRemoteAddons } from '../services/addonService';
import { catalogSignature } from '../services/catalogSignature';
import { toErrorMessage } from '../services/errors';
import { clientFor } from '../services/clientFor';

export type RemoteStatus = 'idle' | 'syncing' | 'error' | 'success';

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
}

/**
 * Owns the remote data for the active account: catalog rows, installed
 * addons, the pulled remote payload, and the load/save status. The catalog
 * editor operations (move/toggle/title/enable/disable) live here too, since
 * they operate on the `catalogs` state owned by this hook.
 */
export function useRemoteData(activeAccount: ManagedAccount | null): UseRemoteDataResult {
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

  const load = useCallback(async () => {
    const account = activeAccountRef.current;
    if (!account) return;

    setIsLoading(true);
    setStatus('idle');
    try {
      const client = clientFor(account);

      // 1. Fetch installed addons
      let fetchedAddons: InstalledAddon[] = [];
      try {
        fetchedAddons = await fetchRemoteAddons(client, account.activeProfileId, account.userId);
      } catch (e) {
        console.warn('Could not load addons from table, using fallback defaults:', e);
        try {
          const defaultManifest = await fetchAddonManifest('https://v3-cinemeta.strem.io/manifest.json');
          fetchedAddons = [
            {
              url: 'https://v3-cinemeta.strem.io/manifest.json',
              name: 'Cinemeta',
              enabled: true,
              sort_order: 0,
              manifest: defaultManifest,
            },
          ];
        } catch {
          // No fallback manifest available; leave fetchedAddons empty.
        }
      }
      setAddons(fetchedAddons);

      // 2. Fetch remote catalog layout
      const payload = await pullRemoteCatalogSettings(client, account.activeProfileId);
      setRemotePayload(payload);

      // 3. Synthesize enriched rows
      const enriched = enrichCatalogs(fetchedAddons, payload);
      setCatalogs(enriched);
      setBaselineSignature(catalogSignature(enriched));

      setStatus('success');
      setStatusMessage('Catalogs Loaded');
    } catch (err) {
      console.error('Failed to load remote data', err);
      setStatus('error');
      setStatusMessage(toErrorMessage(err, 'Error fetching from Supabase'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load when the account or profile changes.
  useEffect(() => {
    if (activeAccount) {
      load();
    }
  }, [activeAccount, load]);

  const pushCatalogs = useCallback(async () => {
    const account = activeAccountRef.current;
    if (!account) return;

    setIsSaving(true);
    setStatus('syncing');
    try {
      const client = clientFor(account);
      const payload = buildSyncPayload(catalogsRef.current, remotePayloadRef.current);
      await pushRemoteCatalogSettings(client, account.activeProfileId, payload);

      setRemotePayload(payload);
      setBaselineSignature(catalogSignature(catalogsRef.current));
      setStatus('success');
      setStatusMessage('Pushed to TV successfully!');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      console.error('Failed to push catalog settings:', err);
      setStatus('error');
      setStatusMessage(toErrorMessage(err, 'Push failed'));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addAddon = useCallback(
    async (url: string) => {
      const account = activeAccountRef.current;
      if (!account) return;
      const manifest = await fetchAddonManifest(url);
      const newAddon: InstalledAddon = {
        url,
        name: manifest.name,
        enabled: true,
        sort_order: addonsRef.current.length,
        manifest,
      };
      const updated = [...addonsRef.current, newAddon];
      setAddons(updated);

      const client = clientFor(account);
      await pushRemoteAddons(client, account.activeProfileId, updated);
      load();
    },
    [load]
  );

  const toggleAddon = useCallback(async (url: string) => {
    const account = activeAccountRef.current;
    if (!account) return;
    const updated = addonsRef.current.map((a) =>
      a.url === url ? { ...a, enabled: !a.enabled } : a
    );
    setAddons(updated);

    const client = clientFor(account);
    await pushRemoteAddons(client, account.activeProfileId, updated);
  }, []);

  const removeAddon = useCallback(
    async (url: string) => {
      const account = activeAccountRef.current;
      if (!account) return;
      const updated = addonsRef.current.filter((a) => a.url !== url);
      setAddons(updated);

      const client = clientFor(account);
      await pushRemoteAddons(client, account.activeProfileId, updated);
      load();
    },
    [load]
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

  const hasUnsavedChanges =
    baselineSignature !== '' && catalogSignature(catalogs) !== baselineSignature;

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
  };
}
