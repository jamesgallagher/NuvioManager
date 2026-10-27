import { describe, it, expect, afterEach, vi } from 'vitest';
import { normalizeManifestUrl, fetchAddonManifest } from './manifestService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeManifestUrl', () => {
  it('adds /manifest.json', () => {
    expect(normalizeManifestUrl('https://example.invalid')).toBe('https://example.invalid/manifest.json');
  });

  it('keeps an existing /manifest.json', () => {
    expect(normalizeManifestUrl('https://example.invalid/manifest.json')).toBe('https://example.invalid/manifest.json');
  });

  it('keeps an existing MANIFEST.JSON (case-insensitive)', () => {
    expect(normalizeManifestUrl('https://example.invalid/MANIFEST.JSON')).toBe('https://example.invalid/MANIFEST.JSON');
  });

  it('strips trailing slashes and whitespace', () => {
    expect(normalizeManifestUrl('  https://example.invalid/  ')).toBe('https://example.invalid/manifest.json');
  });

  it('keeps a query string intact', () => {
    const result = normalizeManifestUrl('https://example.invalid?foo=bar');
    expect(result).toContain('?foo=bar');
    expect(result).toContain('/manifest.json');
  });

  it('rejects ftp://', () => {
    expect(() => normalizeManifestUrl('ftp://x')).toThrow(/Invalid addon URL/);
  });

  it('rejects javascript:alert(1)', () => {
    expect(() => normalizeManifestUrl('javascript:alert(1)')).toThrow(/Invalid addon URL/);
  });

  it('rejects not a url', () => {
    expect(() => normalizeManifestUrl('not a url')).toThrow(/Invalid addon URL/);
  });
});

describe('fetchAddonManifest', () => {
  it('success returns the manifest', async () => {
    const manifest = { id: 'test', name: 'Test', types: ['movie'], catalogs: [{ id: 'c1', type: 'movie' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => manifest,
    }));
    const result = await fetchAddonManifest('https://example.invalid');
    expect(result).toEqual(manifest);
  });

  it('HTTP 404 throws and fetch is called exactly once with the addon own URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe('https://example.invalid/manifest.json');
    expect(calledUrl).not.toContain('allorigins');
  });

  it('network error throws, still one call', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/Network error/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalid JSON throws Invalid manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('invalid json');
      },
    }));
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/Invalid manifest/);
  });

  it('manifest missing id throws Invalid manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ name: 'Test', types: ['movie'] }),
    }));
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/Invalid manifest/);
  });

  it('types not an array throws Invalid manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 'test', name: 'Test', types: 'movie' }),
    }));
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/Invalid manifest/);
  });

  it('catalogs item without type throws Invalid manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 'test', name: 'Test', types: ['movie'], catalogs: [{ id: 'c1' }] }),
    }));
    await expect(fetchAddonManifest('https://example.invalid')).rejects.toThrow(/Invalid manifest/);
  });

  it('a fetch that never resolves times out with a message containing timed out', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const promise = fetchAddonManifest('https://example.invalid', 100);
    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow(/timed out/);
    vi.useRealTimers();
  });
});
