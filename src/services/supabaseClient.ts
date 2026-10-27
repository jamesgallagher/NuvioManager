import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://api.nuvio.tv';
export const DEFAULT_SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Thrown when a Supabase client is requested without an anon key.
 */
export class MissingAnonKeyError extends Error {
  constructor() {
    super('A Supabase anon key is required');
    this.name = 'MissingAnonKeyError';
  }
}

const clientCache = new Map<string, SupabaseClient>();

function cacheKey(url: string, anonKey: string, accessToken?: string): string {
  return `${url}__${anonKey}__${accessToken || 'anon'}`;
}

export function getSupabaseClient(
  url: string = DEFAULT_SUPABASE_URL,
  anonKey: string = DEFAULT_SUPABASE_ANON_KEY,
  accessToken?: string
): SupabaseClient {
  const key = anonKey.trim();
  if (key.length === 0) {
    throw new MissingAnonKeyError();
  }
  const keyStr = cacheKey(url, key, accessToken);
  if (clientCache.has(keyStr)) {
    return clientCache.get(keyStr)!;
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  clientCache.set(keyStr, client);
  return client;
}

/**
 * Remove cached clients. With no argument, removes all; with a url, removes
 * the clients cached for that url (any anon key / token).
 */
export function evictClients(url?: string): void {
  if (url === undefined) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.startsWith(`${url}__`)) {
      clientCache.delete(key);
    }
  }
}
