import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadServerSettings, saveServerSettings, clearServerSettings } from './serverSettings';
import { InvalidAnonKeyError } from './anonKey';

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a fake JWT (header.payload.signature) with a dummy signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

const anonKey = fakeJwt({ role: 'anon' });
const serviceRoleKey = fakeJwt({ role: 'service_role' });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serverSettings', () => {
  it('empty → null', () => {
    expect(loadServerSettings()).toBeNull();
  });

  it('save then load round-trips with savedAt as ISO time', () => {
    saveServerSettings(anonKey);
    const settings = loadServerSettings();
    expect(settings).not.toBeNull();
    expect(settings!.supabaseAnonKey).toBe(anonKey);
    expect(settings!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(settings!.savedAt).toISOString()).toBe(settings!.savedAt);
  });

  it('saving a service_role key throws InvalidAnonKeyError with the reason and stores nothing', () => {
    expect(() => saveServerSettings(serviceRoleKey)).toThrow(InvalidAnonKeyError);
    try {
      saveServerSettings(serviceRoleKey);
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidAnonKeyError);
      expect((e as InvalidAnonKeyError).reason).toBe('role');
    }
    expect(loadServerSettings()).toBeNull();
  });

  it('saving a garbage key throws InvalidAnonKeyError with the reason and stores nothing', () => {
    expect(() => saveServerSettings('not-a-jwt')).toThrow(InvalidAnonKeyError);
    try {
      saveServerSettings('not-a-jwt');
    } catch (e) {
      expect((e as InvalidAnonKeyError).reason).toBe('format');
    }
    expect(loadServerSettings()).toBeNull();
  });

  it('clear removes it', () => {
    saveServerSettings(anonKey);
    clearServerSettings();
    expect(loadServerSettings()).toBeNull();
  });

  it('corrupt JSON in storage → load returns null', () => {
    localStorage.setItem('nuvio_server_settings_v1', 'not json');
    expect(loadServerSettings()).toBeNull();
  });

  it('a throwing localStorage does not make load or clear throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => loadServerSettings()).not.toThrow();
    expect(loadServerSettings()).toBeNull();
    expect(() => clearServerSettings()).not.toThrow();
  });

  it('a throwing localStorage makes save report the clear error', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveServerSettings(anonKey)).toThrow('Could not save settings in this browser');
  });
});
