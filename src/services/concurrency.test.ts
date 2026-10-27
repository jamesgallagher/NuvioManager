import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('never runs more than limit at once', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const results = await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return n;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(results).toEqual(items);
  });

  it('returns results in input order', async () => {
    const items = [5, 3, 8, 1, 2];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      await new Promise((r) => setTimeout(r, (5 - n) * 5));
      return n * 10;
    });
    expect(results).toEqual([50, 30, 80, 10, 20]);
  });

  it('propagates the fn rejection', async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithConcurrency(items, 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow(/boom/);
  });

  it('handles an empty array', async () => {
    const results = await mapWithConcurrency([], 3, async (n: number) => n);
    expect(results).toEqual([]);
  });
});
