import { SupabaseClient } from '@supabase/supabase-js';
import {
  AddonManifest,
  EnrichedCatalogRow,
  InstalledAddon,
  SyncCatalogItem,
  SyncHomeCatalogPayload,
} from '../types/nuvio';

const PLATFORM = 'home_catalog_shared';

export interface RemoteCatalogSettingsBlob {
  profile_id: number;
  settings_json: SyncHomeCatalogPayload;
  updated_at?: string;
}

/**
 * Fetch remote catalog configuration from Supabase
 */
export async function pullRemoteCatalogSettings(
  client: SupabaseClient,
  profileId: number
): Promise<SyncHomeCatalogPayload | null> {
  const { data, error } = await client.rpc('sync_pull_home_catalog_settings', {
    p_profile_id: profileId,
    p_platform: PLATFORM,
  });

  if (error) {
    console.error('Failed to pull remote home catalog settings:', error);
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const blob = data[0] as RemoteCatalogSettingsBlob;
  return blob.settings_json || null;
}

/**
 * Push new catalog configuration to Supabase
 */
export async function pushRemoteCatalogSettings(
  client: SupabaseClient,
  profileId: number,
  payload: SyncHomeCatalogPayload
): Promise<void> {
  const originClientId = `nuvio-support-web-${Math.random().toString(36).substring(2, 10)}`;

  const { error } = await client.rpc('sync_push_home_catalog_settings', {
    p_profile_id: profileId,
    p_settings_json: payload,
    p_platform: PLATFORM,
    p_origin_client_id: originClientId,
  });

  if (error) {
    console.error('Failed to push home catalog settings:', error);
    throw error;
  }
}

/**
 * Fetch addon manifest from URL with fallback
 */
export async function fetchAddonManifest(baseUrl: string): Promise<AddonManifest> {
  let manifestUrl = baseUrl.trim();
  if (manifestUrl.endsWith('/manifest.json')) {
    // already full manifest url
  } else {
    manifestUrl = `${manifestUrl.replace(/\/+$/, '')}/manifest.json`;
  }

  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    // Attempt fallback with CORS proxy if running in browser
    try {
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(manifestUrl)}`;
      const res = await fetch(corsProxyUrl);
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      return await res.json();
    } catch {
      throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${(err as Error).message}`);
    }
  }
}

/**
 * Build canonical catalog key
 */
export function buildCatalogKey(addonId: string, type: string, catalogId: string): string {
  return `${addonId}_${type.trim().toLowerCase()}_${catalogId.trim()}`;
}

/**
 * Synthesize catalog rows from installed addons and existing remote settings
 */
export function enrichCatalogs(
  addons: InstalledAddon[],
  remotePayload: SyncHomeCatalogPayload | null
): EnrichedCatalogRow[] {
  const remoteItemsMap = new Map<string, SyncCatalogItem>();
  if (remotePayload && Array.isArray(remotePayload.items)) {
    for (const item of remotePayload.items) {
      if (item.is_collection) {
        remoteItemsMap.set(`collection_${item.collection_id}`, item);
      } else {
        const key = buildCatalogKey(item.addon_id, item.type, item.catalog_id);
        remoteItemsMap.set(key, item);
      }
    }
  }

  const rows: EnrichedCatalogRow[] = [];
  const processedKeys = new Set<string>();

  for (const addon of addons) {
    if (!addon.enabled && addon.enabled !== undefined) continue;
    if (!addon.manifest || !addon.manifest.catalogs) continue;

    for (const catalog of addon.manifest.catalogs) {
      // Filter search-only catalogs (they don't belong on Home)
      const isSearchOnly = catalog.extra?.some(
        (e) => e.name.toLowerCase() === 'search' && e.isRequired
      );
      if (isSearchOnly) continue;

      const key = buildCatalogKey(addon.manifest.id, catalog.type, catalog.id);
      processedKeys.add(key);

      const remoteSetting = remoteItemsMap.get(key);

      rows.push({
        key,
        addonId: addon.manifest.id,
        addonName: addon.manifest.name || addon.name || addon.url,
        addonBaseUrl: addon.url,
        addonLogo: addon.manifest.logo,
        catalogId: catalog.id,
        catalogName: catalog.name || catalog.id,
        customTitle: remoteSetting?.custom_title || '',
        type: catalog.type,
        enabled: remoteSetting ? remoteSetting.enabled : true,
        order: remoteSetting ? remoteSetting.order : 9999,
        isCollection: false,
        collectionId: '',
      });
    }
  }

  // Preserve any collections from remote payload
  if (remotePayload && Array.isArray(remotePayload.items)) {
    for (const item of remotePayload.items) {
      if (item.is_collection) {
        const key = `collection_${item.collection_id}`;
        rows.push({
          key,
          addonId: '',
          addonName: 'Collection',
          addonBaseUrl: '',
          catalogId: item.collection_id,
          catalogName: item.custom_title || `Collection ${item.collection_id}`,
          customTitle: item.custom_title || '',
          type: 'collection',
          enabled: item.enabled,
          order: item.order,
          isCollection: true,
          collectionId: item.collection_id,
        });
      }
    }
  }

  // Sort rows based on order
  rows.sort((a, b) => a.order - b.order);

  // Normalize order indices (0, 1, 2, ...)
  return rows.map((row, index) => ({
    ...row,
    order: index,
  }));
}

/**
 * Format EnrichedCatalogRows back into a SyncHomeCatalogPayload
 */
export function buildSyncPayload(
  rows: EnrichedCatalogRow[],
  hideUnreleasedContent: boolean = false
): SyncHomeCatalogPayload {
  const items: SyncCatalogItem[] = rows.map((row, index) => ({
    addon_id: row.isCollection ? '' : row.addonId,
    type: row.isCollection ? '' : row.type,
    catalog_id: row.isCollection ? '' : row.catalogId,
    enabled: row.enabled,
    order: index,
    custom_title: row.customTitle.trim(),
    is_collection: row.isCollection,
    collection_id: row.isCollection ? row.collectionId : '',
  }));

  return {
    hide_unreleased_content: hideUnreleasedContent,
    items,
  };
}
