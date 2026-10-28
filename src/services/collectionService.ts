import { SupabaseClient } from '@supabase/supabase-js';

export interface CollectionFolderSummary {
  id: string;
  title: string;
  sourceCount: number;
}

export interface CollectionSummary {
  id: string;
  title: string;
  pinToTop: boolean;
  folders: CollectionFolderSummary[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/**
 * Read-only summary of a profile's collections. Parsing is deliberately
 * tolerant: this app never writes collections back, so an unexpected shape
 * should show less detail, never break the page or touch the TV's data.
 */
export function summarizeCollections(json: unknown): CollectionSummary[] {
  let list: unknown = json;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const out: CollectionSummary[] = [];
  list.forEach((raw, index) => {
    const collection = asRecord(raw);
    if (!collection) return;
    const folders: CollectionFolderSummary[] = [];
    if (Array.isArray(collection.folders)) {
      collection.folders.forEach((rawFolder, folderIndex) => {
        const folder = asRecord(rawFolder);
        if (!folder) return;
        const sources = Array.isArray(folder.sources)
          ? folder.sources
          : Array.isArray(folder.catalogSources)
            ? folder.catalogSources
            : [];
        folders.push({
          id: asText(folder.id) || `folder-${folderIndex}`,
          title: asText(folder.title) || asText(folder.name) || 'Untitled folder',
          sourceCount: sources.length,
        });
      });
    }
    out.push({
      id: asText(collection.id) || `collection-${index}`,
      title: asText(collection.title) || asText(collection.name) || 'Untitled collection',
      pinToTop: collection.pinToTop === true || collection.pin_to_top === true,
      folders,
    });
  });
  return out;
}

/** Pull a profile's collections (read only). */
export async function pullRemoteCollections(
  client: SupabaseClient,
  profileId: number
): Promise<CollectionSummary[]> {
  const { data, error } = await client.rpc('sync_pull_collections', { p_profile_id: profileId });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return [];
  const row = asRecord(data[0]);
  return row ? summarizeCollections(row.collections_json) : [];
}
