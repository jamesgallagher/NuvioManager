import { describe, it, expect } from 'vitest';
import {
  buildCatalogKey,
  enrichCatalogs,
  buildSyncPayload,
  findUnmatchedRemoteItems,
} from './catalogService';
import {
  EnrichedCatalogRow,
  InstalledAddon,
  SyncCatalogItem,
  SyncHomeCatalogPayload,
} from '../types/nuvio';

// Helpers to build test data
function addon(
  url: string,
  manifest: Partial<InstalledAddon['manifest']> | undefined,
  extra: Partial<InstalledAddon> = {}
): InstalledAddon {
  return {
    url,
    manifest: manifest as InstalledAddon['manifest'],
    ...extra,
  };
}

function row(partial: Partial<EnrichedCatalogRow>): EnrichedCatalogRow {
  return {
    key: partial.key ?? '',
    addonId: partial.addonId ?? '',
    addonName: partial.addonName ?? '',
    addonBaseUrl: partial.addonBaseUrl ?? '',
    catalogId: partial.catalogId ?? '',
    catalogName: partial.catalogName ?? '',
    customTitle: partial.customTitle ?? '',
    type: partial.type ?? '',
    enabled: partial.enabled ?? true,
    order: partial.order ?? 0,
    isCollection: partial.isCollection ?? false,
    collectionId: partial.collectionId ?? '',
  };
}

function item(partial: Partial<SyncCatalogItem>): SyncCatalogItem {
  return {
    addon_id: partial.addon_id ?? '',
    type: partial.type ?? '',
    catalog_id: partial.catalog_id ?? '',
    enabled: partial.enabled ?? true,
    order: partial.order ?? 0,
    custom_title: partial.custom_title ?? '',
    is_collection: partial.is_collection ?? false,
    collection_id: partial.collection_id ?? '',
  };
}

describe('buildCatalogKey', () => {
  it('trims and lower-cases type, trims catalogId', () => {
    expect(buildCatalogKey('addonA', '  MOVIE  ', ' cat1 ')).toBe('addonA_movie_cat1');
  });
});

describe('enrichCatalogs', () => {
  it('rows from two addons come out sorted by remote order, then reindexed 0..n-1', () => {
    const addons = [
      addon('https://a.example/manifest.json', {
        id: 'addonA',
        name: 'A',
        types: ['movie'],
        catalogs: [{ id: 'a1', type: 'movie', name: 'A1' }],
      }),
      addon('https://b.example/manifest.json', {
        id: 'addonB',
        name: 'B',
        types: ['movie'],
        catalogs: [{ id: 'b1', type: 'movie', name: 'B1' }],
      }),
    ];
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', order: 2 }),
        item({ addon_id: 'addonB', type: 'movie', catalog_id: 'b1', order: 0 }),
      ],
    };
    const rows = enrichCatalogs(addons, remotePayload);
    expect(rows.map((r) => r.key)).toEqual(['addonB_movie_b1', 'addonA_movie_a1']);
    expect(rows.map((r) => r.order)).toEqual([0, 1]);
  });

  it('skips a catalog whose search extra is required; keeps one whose search is optional', () => {
    const addons = [
      addon('https://a.example/manifest.json', {
        id: 'addonA',
        name: 'A',
        types: ['movie'],
        catalogs: [
          { id: 'a1', type: 'movie', name: 'A1', extra: [{ name: 'search', isRequired: true }] },
          { id: 'a2', type: 'movie', name: 'A2', extra: [{ name: 'search', isRequired: false }] },
        ],
      }),
    ];
    const rows = enrichCatalogs(addons, null);
    expect(rows.map((r) => r.catalogId)).toEqual(['a2']);
  });

  it('a disabled addon produces no rows; an addon with no manifest produces no rows', () => {
    const addons = [
      addon(
        'https://a.example/manifest.json',
        { id: 'addonA', name: 'A', types: ['movie'], catalogs: [{ id: 'a1', type: 'movie', name: 'A1' }] },
        { enabled: false }
      ),
      addon('https://b.example/manifest.json', undefined, { error: 'failed' }),
    ];
    const rows = enrichCatalogs(addons, null);
    expect(rows).toEqual([]);
  });

  it('a remote setting sets enabled, customTitle, order; a catalog with no remote setting gets enabled true and sorts last', () => {
    const addons = [
      addon('https://a.example/manifest.json', {
        id: 'addonA',
        name: 'A',
        types: ['movie'],
        catalogs: [
          { id: 'a1', type: 'movie', name: 'A1' },
          { id: 'a2', type: 'movie', name: 'A2' },
        ],
      }),
    ];
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', enabled: false, order: 0, custom_title: 'Custom A1' }),
      ],
    };
    const rows = enrichCatalogs(addons, remotePayload);
    const a1 = rows.find((r) => r.catalogId === 'a1');
    expect(a1?.enabled).toBe(false);
    expect(a1?.customTitle).toBe('Custom A1');
    const a2 = rows.find((r) => r.catalogId === 'a2');
    expect(a2?.enabled).toBe(true);
    expect(rows.map((r) => r.catalogId)).toEqual(['a1', 'a2']);
  });

  it('remote collections become rows with isCollection true and collectionId', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ enabled: true, order: 0, custom_title: 'My Collection', is_collection: true, collection_id: 'col1' }),
      ],
    };
    const rows = enrichCatalogs([], remotePayload);
    expect(rows.length).toBe(1);
    expect(rows[0].isCollection).toBe(true);
    expect(rows[0].collectionId).toBe('col1');
    expect(rows[0].key).toBe('collection_col1');
  });
});

describe('buildSyncPayload / findUnmatchedRemoteItems', () => {
  const rows: EnrichedCatalogRow[] = [
    row({ key: 'addonA_movie_a1', addonId: 'addonA', catalogId: 'a1', type: 'movie', enabled: true, order: 0, customTitle: 'A1' }),
    row({ key: 'addonB_movie_b1', addonId: 'addonB', catalogId: 'b1', type: 'movie', enabled: false, order: 1, customTitle: 'B1' }),
  ];

  it('rows only, remotePayload null -> items equal rows, hide_unreleased_content false', () => {
    const payload = buildSyncPayload(rows, null);
    expect(payload.hide_unreleased_content).toBe(false);
    expect(payload.items.length).toBe(2);
    expect(payload.items[0]).toEqual(
      item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', enabled: true, order: 0, custom_title: 'A1' })
    );
    expect(payload.items[1].order).toBe(1);
  });

  it('remotePayload.hide_unreleased_content === true -> pushed payload has true', () => {
    const payload = buildSyncPayload(rows, { hide_unreleased_content: true, items: [] });
    expect(payload.hide_unreleased_content).toBe(true);
  });

  it('a remote item for a disabled addon (no row) is kept with its original fields and appended after the rows with consecutive order', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', order: 0 }),
        item({ addon_id: 'addonDisabled', type: 'movie', catalog_id: 'd1', enabled: false, order: 3, custom_title: 'Disabled D1' }),
      ],
    };
    const payload = buildSyncPayload(rows, remotePayload);
    expect(payload.items.length).toBe(3);
    expect(payload.items[2]).toEqual(
      item({ addon_id: 'addonDisabled', type: 'movie', catalog_id: 'd1', enabled: false, order: 2, custom_title: 'Disabled D1' })
    );
  });

  it('a remote item for an addon whose manifest failed is kept the same way', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonFailedManifest', type: 'movie', catalog_id: 'f1', enabled: true, order: 5, custom_title: 'Failed F1' }),
      ],
    };
    const payload = buildSyncPayload(rows, remotePayload);
    expect(payload.items).toContainEqual(
      item({ addon_id: 'addonFailedManifest', type: 'movie', catalog_id: 'f1', enabled: true, order: 2, custom_title: 'Failed F1' })
    );
  });

  it('two preserved items keep their original relative order', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonX', type: 'movie', catalog_id: 'x1', order: 10 }),
        item({ addon_id: 'addonY', type: 'movie', catalog_id: 'y1', order: 2 }),
      ],
    };
    const payload = buildSyncPayload(rows, remotePayload);
    expect(payload.items[2].addon_id).toBe('addonY');
    expect(payload.items[3].addon_id).toBe('addonX');
  });

  it('a remote item that matches a row is not duplicated', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', order: 0 }),
        item({ addon_id: 'addonB', type: 'movie', catalog_id: 'b1', order: 1 }),
      ],
    };
    const payload = buildSyncPayload(rows, remotePayload);
    expect(payload.items.length).toBe(2);
  });

  it('a collection is not duplicated and not treated as unmatched', () => {
    const collectionRows: EnrichedCatalogRow[] = [
      row({ key: 'collection_col1', catalogId: 'col1', type: 'collection', enabled: true, order: 0, customTitle: 'Col', isCollection: true, collectionId: 'col1' }),
    ];
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ enabled: true, order: 0, custom_title: 'My Collection', is_collection: true, collection_id: 'col1' }),
      ],
    };
    const payload = buildSyncPayload(collectionRows, remotePayload);
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].is_collection).toBe(true);
    expect(payload.items[0].collection_id).toBe('col1');
  });

  it("a row's customTitle is trimmed; collection rows send empty addon_id, type, catalog_id", () => {
    const mixedRows: EnrichedCatalogRow[] = [
      row({ key: 'addonA_movie_a1', addonId: 'addonA', catalogId: 'a1', type: 'movie', enabled: true, order: 0, customTitle: '  A1  ' }),
      row({ key: 'collection_col1', catalogId: 'col1', type: 'collection', enabled: true, order: 1, customTitle: 'Col', isCollection: true, collectionId: 'col1' }),
    ];
    const payload = buildSyncPayload(mixedRows, null);
    expect(payload.items[0].custom_title).toBe('A1');
    expect(payload.items[1].addon_id).toBe('');
    expect(payload.items[1].type).toBe('');
    expect(payload.items[1].catalog_id).toBe('');
  });

  it('round trip: enrichCatalogs then buildSyncPayload with no edits produces items equal (as a set of key fields) to the remote payload', () => {
    const addons = [
      addon('https://a.example/manifest.json', { id: 'addonA', name: 'A', types: ['movie'], catalogs: [{ id: 'a1', type: 'movie', name: 'A1' }] }),
      addon('https://b.example/manifest.json', { id: 'addonB', name: 'B', types: ['movie'], catalogs: [{ id: 'b1', type: 'movie', name: 'B1' }] }, { enabled: false }),
    ];
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: true,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', enabled: false, order: 0, custom_title: 'A1' }),
        item({ addon_id: 'addonB', type: 'movie', catalog_id: 'b1', enabled: true, order: 1, custom_title: 'B1' }),
        item({ enabled: true, order: 2, custom_title: 'Col', is_collection: true, collection_id: 'col1' }),
      ],
    };
    const rows = enrichCatalogs(addons, remotePayload);
    const payload = buildSyncPayload(rows, remotePayload);

    const keyFields = (i: SyncCatalogItem) =>
      `${i.addon_id}|${i.type}|${i.catalog_id}|${i.collection_id}`;
    expect(new Set(payload.items.map(keyFields))).toEqual(new Set(remotePayload.items.map(keyFields)));
  });

  it('findUnmatchedRemoteItems returns only the unmatched items in original order', () => {
    const remotePayload: SyncHomeCatalogPayload = {
      hide_unreleased_content: false,
      items: [
        item({ addon_id: 'addonA', type: 'movie', catalog_id: 'a1', order: 0 }), // matches a row
        item({ addon_id: 'addonX', type: 'movie', catalog_id: 'x1', order: 10 }),
        item({ addon_id: 'addonY', type: 'movie', catalog_id: 'y1', order: 2 }),
      ],
    };
    const unmatched = findUnmatchedRemoteItems(rows, remotePayload);
    expect(unmatched.map((i) => i.addon_id)).toEqual(['addonY', 'addonX']);
  });
});
