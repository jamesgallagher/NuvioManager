import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeOriginClientId } from './originClient';

let counter = 0;

beforeEach(() => {
  counter = 0;
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint32Array) => {
      counter++;
      for (let i = 0; i < arr.length; i++) arr[i] = (counter * 7 + i) % 36;
      return arr;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeOriginClientId', () => {
  it('has the prefix', () => {
    const id = makeOriginClientId();
    expect(id.startsWith('nuvio-support-web-')).toBe(true);
  });

  it('has 8 base36 chars', () => {
    const id = makeOriginClientId();
    const suffix = id.substring('nuvio-support-web-'.length);
    expect(suffix.length).toBe(8);
    expect(/^[a-z0-9]{8}$/.test(suffix)).toBe(true);
  });

  it('two calls differ', () => {
    const a = makeOriginClientId();
    const b = makeOriginClientId();
    expect(a).not.toBe(b);
  });
});
