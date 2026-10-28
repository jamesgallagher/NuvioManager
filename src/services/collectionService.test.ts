import { describe, it, expect, vi } from 'vitest';
import { summarizeCollections, pullRemoteCollections } from './collectionService';

describe('summarizeCollections', () => {
  it('summarizes collections, folders and source counts', () => {
    const out = summarizeCollections([
      {
        id: 'c1',
        title: 'Streaming',
        pinToTop: true,
        folders: [
          { id: 'f1', title: 'Netflix', sources: [{ addonId: 'a' }, { addonId: 'b' }] },
          { id: 'f2', title: 'Disney', sources: [] },
        ],
      },
    ]);
    expect(out).toEqual([
      {
        id: 'c1',
        title: 'Streaming',
        pinToTop: true,
        folders: [
          { id: 'f1', title: 'Netflix', sourceCount: 2 },
          { id: 'f2', title: 'Disney', sourceCount: 0 },
        ],
      },
    ]);
  });

  it('accepts the JSON as a string', () => {
    const out = summarizeCollections(JSON.stringify([{ id: 'c', title: 'T', folders: [] }]));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('T');
  });

  it('is tolerant of missing and odd fields', () => {
    const out = summarizeCollections([
      { folders: [{}, null, 'x', { name: 'Named', catalogSources: [1] }] },
      { id: 5, name: 'Numeric id', pin_to_top: true },
      null,
      'nope',
      [],
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'collection-0',
      title: 'Untitled collection',
      pinToTop: false,
      folders: [
        { id: 'folder-0', title: 'Untitled folder', sourceCount: 0 },
        { id: 'folder-3', title: 'Named', sourceCount: 1 },
      ],
    });
    expect(out[1]).toMatchObject({ id: '5', title: 'Numeric id', pinToTop: true, folders: [] });
  });

  it('returns [] for non-lists and bad JSON', () => {
    expect(summarizeCollections(null)).toEqual([]);
    expect(summarizeCollections({})).toEqual([]);
    expect(summarizeCollections('not json')).toEqual([]);
    expect(summarizeCollections(undefined)).toEqual([]);
  });
});

describe('pullRemoteCollections', () => {
  it('calls sync_pull_collections for the profile and summarizes the blob', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ profile_id: 2, collections_json: [{ id: 'c', title: 'T', folders: [] }] }],
        error: null,
      }),
    };
    const out = await pullRemoteCollections(client as never, 2);
    expect(client.rpc).toHaveBeenCalledWith('sync_pull_collections', { p_profile_id: 2 });
    expect(out.map((c) => c.title)).toEqual(['T']);
  });

  it('returns [] when the server has no row', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    expect(await pullRemoteCollections(client as never, 1)).toEqual([]);
  });

  it('throws the RPC error', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('denied') }) };
    await expect(pullRemoteCollections(client as never, 1)).rejects.toThrow('denied');
  });

  it('never writes: only the pull RPC is called', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    await pullRemoteCollections(client as never, 1);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc.mock.calls[0][0]).toBe('sync_pull_collections');
  });
});
