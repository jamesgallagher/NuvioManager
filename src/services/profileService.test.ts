import { describe, it, expect, vi } from 'vitest';
import { mapProfileRows, sanitizeProfiles, pickActiveProfileId, pullProfiles } from './profileService';

const UUID = '2aac3849-8c96-4d55-9a16-db407c13b5de';

describe('mapProfileRows', () => {
  it('uses profile_index as the id, not the row UUID', () => {
    const rows = [{ id: UUID, profile_index: 2, name: 'Daddo', is_primary: false, avatar_color_hex: '#fff' }];
    expect(mapProfileRows(rows)).toEqual([
      { id: 2, name: 'Daddo', isPrimary: false, avatarColorHex: '#fff' },
    ]);
  });

  it('sorts by index, de-duplicates, and names unnamed profiles', () => {
    const out = mapProfileRows([
      { id: 'b', profile_index: 3, name: '  ' },
      { id: 'a', profile_index: 1, name: 'Main', is_primary: true },
      { id: 'c', profile_index: 1, name: 'Duplicate' },
    ]);
    expect(out.map((p) => [p.id, p.name])).toEqual([[1, 'Main'], [3, 'Profile 3']]);
  });

  it('skips rows without a usable integer index', () => {
    const out = mapProfileRows([
      { id: UUID },
      { id: UUID, profile_index: 'two' },
      { id: UUID, profile_index: 1.5 },
      { id: UUID, profile_index: -1 },
      null,
      'x',
    ]);
    expect(out).toEqual([]);
  });

  it('accepts the older shape with a numeric id and no profile_index', () => {
    expect(mapProfileRows([{ id: 4, name: 'Old' }]).map((p) => p.id)).toEqual([4]);
  });

  it('returns [] for non-arrays', () => {
    expect(mapProfileRows(null)).toEqual([]);
    expect(mapProfileRows({})).toEqual([]);
  });
});

describe('sanitizeProfiles', () => {
  it('drops profiles whose id is a UUID or NaN and falls back to Default', () => {
    expect(sanitizeProfiles([{ id: UUID, name: 'Daddo' }, { id: NaN, name: 'x' }])).toEqual([
      { id: 1, name: 'Default', isPrimary: true },
    ]);
  });

  it('keeps valid profiles and drops only the bad ones', () => {
    const out = sanitizeProfiles([{ id: 2, name: 'Kid' }, { id: UUID, name: 'Bad' }]);
    expect(out).toEqual([{ id: 2, name: 'Kid' }]);
  });

  it('never returns an empty list', () => {
    expect(sanitizeProfiles(undefined)).toHaveLength(1);
    expect(sanitizeProfiles([])).toHaveLength(1);
  });
});

describe('pickActiveProfileId', () => {
  const profiles = [{ id: 1, name: 'A' }, { id: 3, name: 'B' }];
  it('keeps the current profile when it exists', () => expect(pickActiveProfileId(3, profiles)).toBe(3));
  it('falls back to the first profile otherwise', () => {
    expect(pickActiveProfileId(2, profiles)).toBe(1);
    expect(pickActiveProfileId(NaN, profiles)).toBe(1);
    expect(pickActiveProfileId(UUID, profiles)).toBe(1);
    expect(pickActiveProfileId(1, undefined)).toBe(1);
  });
});

describe('pullProfiles', () => {
  it('maps the RPC rows', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [{ id: UUID, profile_index: 2, name: 'Daddo' }], error: null }) };
    expect(await pullProfiles(client as never)).toEqual([{ id: 2, name: 'Daddo', isPrimary: undefined, avatarColorHex: undefined }]);
    expect(client.rpc).toHaveBeenCalledWith('sync_pull_profiles');
  });

  it('throws the RPC error', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }) };
    await expect(pullProfiles(client as never)).rejects.toThrow('boom');
  });
});
