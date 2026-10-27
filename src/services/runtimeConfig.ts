export interface RuntimeConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Read the runtime config written by the container's entrypoint (or the static
 * `public/config.js` in dev). The config is `window.__NUVIO_CONFIG__` with
 * `SUPABASE_URL` and `SUPABASE_ANON_KEY` keys. Values are trimmed; empty
 * strings, whitespace-only strings and non-string values are treated as unset.
 * Never throws, even when `window` has no config at all.
 */
export function getRuntimeConfig(): RuntimeConfig {
  const result: RuntimeConfig = {};
  const raw =
    typeof window !== 'undefined' && window.__NUVIO_CONFIG__
      ? window.__NUVIO_CONFIG__
      : undefined;
  if (!raw || typeof raw !== 'object') {
    return result;
  }

  const url = readString(raw.SUPABASE_URL);
  if (url !== undefined) {
    result.supabaseUrl = url;
  }

  const anonKey = readString(raw.SUPABASE_ANON_KEY);
  if (anonKey !== undefined) {
    result.supabaseAnonKey = anonKey;
  }

  return result;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
