import { EnrichedCatalogRow } from '../types/nuvio';

/**
 * Build a canonical signature string from catalog rows, used to detect
 * unsaved changes.
 */
export function catalogSignature(rows: EnrichedCatalogRow[]): string {
  return JSON.stringify(
    rows.map((e) => ({ k: e.key, en: e.enabled, o: e.order, t: e.customTitle }))
  );
}
