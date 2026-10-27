import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, validateAnonKey, maskKey } from './anonKey';

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a fake JWT (header.payload.signature) with a dummy signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe('decodeJwtPayload', () => {
  it('valid token → object', () => {
    const token = fakeJwt({ role: 'anon', exp: 9999999999 });
    expect(decodeJwtPayload(token)).toEqual({ role: 'anon', exp: 9999999999 });
  });

  it('not three parts → null, no throw', () => {
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('bad base64 → null, no throw', () => {
    expect(decodeJwtPayload('header.!!not-base64!!.sig')).toBeNull();
  });

  it('non-JSON payload → null, no throw', () => {
    const header = b64url(JSON.stringify({ alg: 'HS256' }));
    const body = b64url('not json at all');
    expect(decodeJwtPayload(`${header}.${body}.sig`)).toBeNull();
  });

  it('empty string → null, no throw', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });
});

describe('validateAnonKey', () => {
  it("role 'anon' → ok with the trimmed key", () => {
    const token = fakeJwt({ role: 'anon' });
    expect(validateAnonKey(`  ${token}  `)).toEqual({ ok: true, key: token });
  });

  it("role 'service_role' → role", () => {
    expect(validateAnonKey(fakeJwt({ role: 'service_role' }))).toEqual({
      ok: false,
      reason: 'role',
    });
  });

  it("role 'authenticated' → role", () => {
    expect(validateAnonKey(fakeJwt({ role: 'authenticated' }))).toEqual({
      ok: false,
      reason: 'role',
    });
  });

  it('missing role → role', () => {
    expect(validateAnonKey(fakeJwt({ exp: 9999999999 }))).toEqual({
      ok: false,
      reason: 'role',
    });
  });

  it('payload not JSON / two parts / empty → format', () => {
    const header = b64url(JSON.stringify({ alg: 'HS256' }));
    expect(validateAnonKey(`${header}.${b64url('not json')}.sig`)).toEqual({
      ok: false,
      reason: 'format',
    });
    expect(validateAnonKey('a.b')).toEqual({ ok: false, reason: 'format' });
    expect(validateAnonKey('')).toEqual({ ok: false, reason: 'format' });
    expect(validateAnonKey('   ')).toEqual({ ok: false, reason: 'format' });
  });

  it('exp in the past → expired', () => {
    expect(validateAnonKey(fakeJwt({ role: 'anon', exp: 1000000000 }))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('exp in the future → ok', () => {
    expect(validateAnonKey(fakeJwt({ role: 'anon', exp: 9999999999 })).ok).toBe(true);
  });

  it('over 4096 characters → format', () => {
    const token = fakeJwt({ role: 'anon', pad: 'x'.repeat(4100) });
    expect(token.length).toBeGreaterThan(4096);
    expect(validateAnonKey(token)).toEqual({ ok: false, reason: 'format' });
  });

  it('surrounding whitespace is trimmed', () => {
    const token = fakeJwt({ role: 'anon' });
    expect(validateAnonKey(`\n${token}\t`)).toEqual({ ok: true, key: token });
  });
});

describe('maskKey', () => {
  it('shows exactly 8 + … + 4 and never the middle of the key', () => {
    const key = 'abcdefghijklmnopqrstuvwx';
    const masked = maskKey(key);
    expect(masked).toBe('abcdefgh…uvwx');
    expect(masked).not.toContain('ijklmnopqrst');
  });

  it('short input does not throw', () => {
    expect(() => maskKey('abc')).not.toThrow();
  });
});
