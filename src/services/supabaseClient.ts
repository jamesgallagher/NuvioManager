import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://api.nuvio.tv';
export const DEFAULT_SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseClient(
  url: string = DEFAULT_SUPABASE_URL,
  anonKey: string = DEFAULT_SUPABASE_ANON_KEY,
  accessToken?: string
): SupabaseClient {
  const cacheKey = `${url}__${accessToken || 'anon'}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const client = createClient(url, anonKey || 'dummy-anon-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  clientCache.set(cacheKey, client);
  return client;
}
