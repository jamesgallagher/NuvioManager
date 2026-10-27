import { SupabaseClient } from '@supabase/supabase-js';
import { ManagedAccount } from '../types/nuvio';
import { getSupabaseClient } from './supabaseClient';

/**
 * Get a Supabase client for a managed account, using its url, anon key and
 * access token.
 */
export function clientFor(account: ManagedAccount): SupabaseClient {
  return getSupabaseClient(account.supabaseUrl, account.supabaseAnonKey, account.accessToken);
}
