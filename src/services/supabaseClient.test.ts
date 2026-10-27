import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSupabaseClient, evictClients, MissingAnonKeyError } from './supabaseClient';

afterEach(() => {
  evictClients();
});

describe('getSupabaseClient', () => {
  it('empty anon key throws MissingAnonKeyError and no client is created', () => {
    expect(() => getSupabaseClient('https://example.invalid', '')).toThrow(MissingAnonKeyError);
  });

  it('whitespace anon key throws MissingAnonKeyError', () => {
    expect(() => getSupabaseClient('https://example.invalid', '   ')).toThrow(MissingAnonKeyError);
  });

  it('same url+key+token returns the cached instance', () => {
    const a = getSupabaseClient('https://example.invalid', 'test-key', 'token1');
    const b = getSupabaseClient('https://example.invalid', 'test-key', 'token1');
    expect(a).toBe(b);
  });

  it('a different anon key returns a different instance', () => {
    const a = getSupabaseClient('https://example.invalid', 'key1', 'token1');
    const b = getSupabaseClient('https://example.invalid', 'key2', 'token1');
    expect(a).not.toBe(b);
  });

  it('evictClients(url) makes the next call create a new one', () => {
    const a = getSupabaseClient('https://example.invalid', 'test-key', 'token1');
    evictClients('https://example.invalid');
    const b = getSupabaseClient('https://example.invalid', 'test-key', 'token1');
    expect(b).not.toBe(a);
  });
});

describe('DEFAULT_SUPABASE_URL / DEFAULT_SUPABASE_ANON_KEY precedence', () => {
  afterEach(() => {
    delete window.__NUVIO_CONFIG__;
    vi.unstubAllEnvs();
  });

  const importFresh = async () => {
    vi.resetModules();
    return await import('./supabaseClient');
  };

  it('runtime config wins over VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY', async () => {
    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: 'https://runtime.invalid',
      SUPABASE_ANON_KEY: 'runtime-key',
    };
    vi.stubEnv('VITE_SUPABASE_URL', 'https://build.invalid');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.DEFAULT_SUPABASE_URL).toBe('https://runtime.invalid');
    expect(mod.DEFAULT_SUPABASE_ANON_KEY).toBe('runtime-key');
  });

  it('with no runtime config the VITE_ values are used', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://build.invalid');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.DEFAULT_SUPABASE_URL).toBe('https://build.invalid');
    expect(mod.DEFAULT_SUPABASE_ANON_KEY).toBe('build-key');
  });

  it('with neither, the URL is https://api.nuvio.tv and the anon key is ""', async () => {
    const mod = await importFresh();
    expect(mod.DEFAULT_SUPABASE_URL).toBe('https://api.nuvio.tv');
    expect(mod.DEFAULT_SUPABASE_ANON_KEY).toBe('');
  });

  it('an empty runtime value falls through to the build-time value', async () => {
    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '   ',
    };
    vi.stubEnv('VITE_SUPABASE_URL', 'https://build.invalid');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.DEFAULT_SUPABASE_URL).toBe('https://build.invalid');
    expect(mod.DEFAULT_SUPABASE_ANON_KEY).toBe('build-key');
  });
});

describe('getDefaultAnonKey precedence', () => {
  afterEach(() => {
    localStorage.clear();
    delete window.__NUVIO_CONFIG__;
    vi.unstubAllEnvs();
  });

  const importFresh = async () => {
    vi.resetModules();
    return await import('./supabaseClient');
  };

  it('saved server setting wins over runtime config and VITE_', async () => {
    localStorage.setItem(
      'nuvio_server_settings_v1',
      JSON.stringify({ supabaseAnonKey: 'saved-key', savedAt: '2026-10-28T00:00:00.000Z' })
    );
    window.__NUVIO_CONFIG__ = { SUPABASE_ANON_KEY: 'runtime-key' };
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.getDefaultAnonKey()).toBe('saved-key');
  });

  it('an empty saved value does not win', async () => {
    localStorage.setItem(
      'nuvio_server_settings_v1',
      JSON.stringify({ supabaseAnonKey: '   ', savedAt: '2026-10-28T00:00:00.000Z' })
    );
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.getDefaultAnonKey()).toBe('build-key');
  });

  it('runtime config wins over VITE_', async () => {
    window.__NUVIO_CONFIG__ = { SUPABASE_ANON_KEY: 'runtime-key' };
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.getDefaultAnonKey()).toBe('runtime-key');
  });

  it('VITE_ wins over the empty default', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key');
    const mod = await importFresh();
    expect(mod.getDefaultAnonKey()).toBe('build-key');
  });

  it('with nothing set, returns the empty string', async () => {
    const mod = await importFresh();
    expect(mod.getDefaultAnonKey()).toBe('');
  });
});
