import { SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types/nuvio';

const DEFAULT_PROFILE: UserProfile = { id: 1, name: 'Default', isPrimary: true };

function isProfileIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Map `sync_pull_profiles` rows to profiles. A row's `id` is a database UUID;
 * the number the other RPCs take as `p_profile_id` is `profile_index`.
 * Rows without a usable integer index are skipped.
 */
export function mapProfileRows(rows: unknown): UserProfile[] {
  if (!Array.isArray(rows)) return [];
  const byIndex = new Map<number, UserProfile>();
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    // Older shape: a numeric `id` and no `profile_index`.
    const index = isProfileIndex(row.profile_index) ? row.profile_index : row.id;
    if (!isProfileIndex(index) || byIndex.has(index)) continue;
    byIndex.set(index, {
      id: index,
      name: typeof row.name === 'string' && row.name.trim() ? row.name : `Profile ${index}`,
      isPrimary: typeof row.is_primary === 'boolean' ? row.is_primary : undefined,
      avatarColorHex:
        typeof row.avatar_color_hex === 'string' ? row.avatar_color_hex : undefined,
    });
  }
  return Array.from(byIndex.values()).sort((a, b) => a.id - b.id);
}

/**
 * Repair stored profiles: keep only those with an integer id (earlier builds
 * saved the row UUID as the id). Never returns an empty list.
 */
export function sanitizeProfiles(profiles: unknown): UserProfile[] {
  if (!Array.isArray(profiles)) return [DEFAULT_PROFILE];
  const kept = profiles.filter(
    (p): p is UserProfile =>
      typeof p === 'object' && p !== null && isProfileIndex((p as UserProfile).id)
  );
  return kept.length > 0 ? kept : [DEFAULT_PROFILE];
}

/** Keep the current profile if it is in the list, otherwise use the first one. */
export function pickActiveProfileId(current: unknown, profiles: UserProfile[] | undefined): number {
  const list = profiles && profiles.length > 0 ? profiles : [DEFAULT_PROFILE];
  return isProfileIndex(current) && list.some((p) => p.id === current) ? current : list[0].id;
}

export async function pullProfiles(client: SupabaseClient): Promise<UserProfile[]> {
  const { data, error } = await client.rpc('sync_pull_profiles');
  if (error) throw error;
  return mapProfileRows(data);
}
