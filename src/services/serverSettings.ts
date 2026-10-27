import { InvalidAnonKeyError, validateAnonKey } from './anonKey';

const SETTINGS_KEY = 'nuvio_server_settings_v1';

export interface ServerSettings {
  supabaseAnonKey: string;
  savedAt: string;
}

/**
 * Load the saved server settings. Returns null when nothing is stored, the
 * stored value is not valid JSON with the expected shape, or localStorage is
 * blocked.
 */
export function loadServerSettings(): ServerSettings | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const settings = parsed as { supabaseAnonKey?: unknown; savedAt?: unknown };
    if (typeof settings.supabaseAnonKey !== 'string') return null;
    return {
      supabaseAnonKey: settings.supabaseAnonKey,
      savedAt:
        typeof settings.savedAt === 'string' ? settings.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Validate and save an anon key as the app-wide default. Throws
 * InvalidAnonKeyError with the reason when the key is not a valid anon key,
 * and a clear Error when localStorage is blocked.
 */
export function saveServerSettings(key: string): void {
  const result = validateAnonKey(key);
  if (!result.ok) throw new InvalidAnonKeyError(result.reason);
  const settings: ServerSettings = {
    supabaseAnonKey: result.key,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    throw new Error('Could not save settings in this browser');
  }
}

/**
 * Remove the saved server settings. Never throws, even when localStorage is
 * blocked.
 */
export function clearServerSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // localStorage blocked; nothing to clear
  }
}
