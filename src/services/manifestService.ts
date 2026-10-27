import { AddonManifest } from '../types/nuvio';

/**
 * Normalise an addon URL into its manifest URL: trim, strip trailing slashes,
 * append /manifest.json unless it already ends with it (case-insensitive).
 * Rejects anything that is not an http: or https: URL.
 */
export function normalizeManifestUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid addon URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid addon URL: ${url}`);
  }
  let manifestUrl = trimmed.replace(/\/+$/, '');
  if (!/\/manifest\.json$/i.test(manifestUrl)) {
    manifestUrl = `${manifestUrl}/manifest.json`;
  }
  return manifestUrl;
}

/**
 * Type guard for a parsed addon manifest.
 */
export function isAddonManifest(value: unknown): value is AddonManifest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.name !== 'string' || v.name.length === 0) return false;
  if (!Array.isArray(v.types) || !v.types.every((t) => typeof t === 'string')) return false;
  if (v.catalogs !== undefined) {
    if (!Array.isArray(v.catalogs)) return false;
    for (const c of v.catalogs) {
      if (typeof c !== 'object' || c === null) return false;
      const cc = c as Record<string, unknown>;
      if (typeof cc.id !== 'string') return false;
      if (typeof cc.type !== 'string') return false;
    }
  }
  return true;
}

/**
 * Fetch an addon manifest from its own host only (no proxy), with a timeout.
 */
export async function fetchAddonManifest(
  baseUrl: string,
  timeoutMs: number = 10000
): Promise<AddonManifest> {
  const manifestUrl = normalizeManifestUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(manifestUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    let data: unknown;
    try {
      data = await res.json();
    } catch (jsonErr) {
      const e = new Error(`Invalid manifest from ${manifestUrl}`);
      (e as { cause?: unknown }).cause = jsonErr;
      throw e;
    }
    if (!isAddonManifest(data)) {
      throw new Error(`Invalid manifest from ${manifestUrl}`);
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const e = new Error(`Manifest fetch from ${manifestUrl} timed out`);
      (e as { cause?: unknown }).cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
