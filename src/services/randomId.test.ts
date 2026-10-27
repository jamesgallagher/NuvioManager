import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeId } from './randomId';
import { randomBytes } from 'node:crypto';

function makeGetRandomValues() {
  return (arr: Uint8Array) => {
    const bytes = randomBytes(arr.length);
    for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
    return arr;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeId', () => {
  it('uses crypto.randomUUID when present', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-uuid-1234' });
    expect(makeId()).toBe('fixed-uuid-1234');
  });

  it('fallback returns a valid v4 UUID when randomUUID is undefined', () => {
    vi.stubGlobal('crypto', { getRandomValues: makeGetRandomValues() });
    const id = makeId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('1000 fallback calls are all different', () => {
    vi.stubGlobal('crypto', { getRandomValues: makeGetRandomValues() });
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(makeId());
    expect(ids.size).toBe(1000);
  });

  it('never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', { getRandomValues: makeGetRandomValues() });
    makeId();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
