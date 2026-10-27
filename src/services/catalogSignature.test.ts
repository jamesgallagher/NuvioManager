import { describe, it, expect } from 'vitest';
import { catalogSignature } from './catalogSignature';
import { EnrichedCatalogRow } from '../types/nuvio';

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

describe('catalogSignature', () => {
  it('same rows -> same string', () => {
    const rows = [
      row({ key: 'a', enabled: true, order: 0, customTitle: 'A' }),
      row({ key: 'b', enabled: false, order: 1, customTitle: 'B' }),
    ];
    expect(catalogSignature(rows)).toBe(catalogSignature(rows));
  });

  it('changing enabled -> different string', () => {
    const rows1 = [row({ key: 'a', enabled: true, order: 0, customTitle: 'A' })];
    const rows2 = [row({ key: 'a', enabled: false, order: 0, customTitle: 'A' })];
    expect(catalogSignature(rows1)).not.toBe(catalogSignature(rows2));
  });

  it('changing order -> different string', () => {
    const rows1 = [row({ key: 'a', enabled: true, order: 0, customTitle: 'A' })];
    const rows2 = [row({ key: 'a', enabled: true, order: 1, customTitle: 'A' })];
    expect(catalogSignature(rows1)).not.toBe(catalogSignature(rows2));
  });

  it('changing customTitle -> different string', () => {
    const rows1 = [row({ key: 'a', enabled: true, order: 0, customTitle: 'A' })];
    const rows2 = [row({ key: 'a', enabled: true, order: 0, customTitle: 'B' })];
    expect(catalogSignature(rows1)).not.toBe(catalogSignature(rows2));
  });
});
