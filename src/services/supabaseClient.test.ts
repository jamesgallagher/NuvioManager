import { describe, it, expect, afterEach } from 'vitest';
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
