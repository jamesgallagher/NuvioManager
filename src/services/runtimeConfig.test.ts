import { describe, it, expect, beforeEach } from 'vitest';
import { getRuntimeConfig } from './runtimeConfig';

beforeEach(() => {
  delete window.__NUVIO_CONFIG__;
});

describe('getRuntimeConfig', () => {
  it('no window.__NUVIO_CONFIG__ → both unset, no throw', () => {
    const config = getRuntimeConfig();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBeUndefined();
  });

  it('config with both values → returned, trimmed', () => {
    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: '  https://example.invalid  ',
      SUPABASE_ANON_KEY: '  test-anon-key  ',
    };
    const config = getRuntimeConfig();
    expect(config.supabaseUrl).toBe('https://example.invalid');
    expect(config.supabaseAnonKey).toBe('test-anon-key');
  });

  it('empty string, whitespace-only and non-string values → unset', () => {
    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '   ',
    };
    let config = getRuntimeConfig();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBeUndefined();

    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: 42,
      SUPABASE_ANON_KEY: null,
    };
    config = getRuntimeConfig();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBeUndefined();

    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: { nested: true },
      SUPABASE_ANON_KEY: ['array'],
    };
    config = getRuntimeConfig();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBeUndefined();
  });

  it('only one of the two set → the other unset', () => {
    window.__NUVIO_CONFIG__ = {
      SUPABASE_URL: 'https://example.invalid',
    };
    let config = getRuntimeConfig();
    expect(config.supabaseUrl).toBe('https://example.invalid');
    expect(config.supabaseAnonKey).toBeUndefined();

    window.__NUVIO_CONFIG__ = {
      SUPABASE_ANON_KEY: 'test-anon-key',
    };
    config = getRuntimeConfig();
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBe('test-anon-key');
  });
});
