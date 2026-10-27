import { SupabaseClient } from '@supabase/supabase-js';
import { InstalledAddon } from '../types/nuvio';
import { fetchAddonManifest } from './catalogService';
import { mapWithConcurrency } from './concurrency';
import { makeOriginClientId } from './originClient';

export interface SupabaseAddonRecord {
  id?: string;
  user_id?: string;
  profile_id?: number;
  url: string;
  name?: string;
  enabled?: boolean;
  sort_order?: number;
}

/**
 * Fetch installed addons from Supabase for a specific profile
 */
export async function fetchRemoteAddons(
  client: SupabaseClient,
  profileId: number,
  userId?: string
): Promise<InstalledAddon[]> {
  let query = client.from('addons').select('*').eq('profile_id', profileId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching addons table:', error);
    throw error;
  }

  const records = (data as SupabaseAddonRecord[]) || [];
  records.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Enrich with manifests, at most 5 in flight at once
  const enriched: InstalledAddon[] = await mapWithConcurrency(records, 5, async (record) => {
    try {
      const manifest = await fetchAddonManifest(record.url);
      return {
        url: record.url,
        name: record.name || manifest.name,
        enabled: record.enabled ?? true,
        sort_order: record.sort_order ?? 0,
        manifest,
      };
    } catch (err) {
      return {
        url: record.url,
        name: record.name || record.url,
        enabled: record.enabled ?? true,
        sort_order: record.sort_order ?? 0,
        error: (err as Error).message,
      };
    }
  });

  return enriched;
}

/**
 * Push updated addons back to Supabase using sync_push_addons RPC
 */
export async function pushRemoteAddons(
  client: SupabaseClient,
  profileId: number,
  addons: InstalledAddon[]
): Promise<void> {
  const pAddons = addons.map((addon, index) => ({
    url: addon.url,
    sort_order: index,
    enabled: addon.enabled ?? true,
    name: addon.name || addon.manifest?.name || '',
  }));

  const originClientId = makeOriginClientId();

  const { error } = await client.rpc('sync_push_addons', {
    p_addons: pAddons,
    p_profile_id: profileId,
    p_origin_client_id: originClientId,
  });

  if (error) {
    console.error('Failed to push addons:', error);
    throw error;
  }
}
