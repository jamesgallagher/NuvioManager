export interface SyncCatalogItem {
  addon_id: string;
  type: string;
  catalog_id: string;
  enabled: boolean;
  order: number;
  custom_title: string;
  is_collection: boolean;
  collection_id: string;
}

export interface SyncHomeCatalogPayload {
  hide_unreleased_content: boolean;
  items: SyncCatalogItem[];
}

export interface CatalogExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
}

export interface CatalogDescriptor {
  id: string;
  type: string;
  name: string;
  extra?: CatalogExtra[];
  pageSize?: number;
}

export interface AddonManifest {
  id: string;
  name: string;
  version?: string;
  description?: string;
  logo?: string;
  background?: string;
  types: string[];
  catalogs?: CatalogDescriptor[];
  resources?: (string | { name: string; types: string[]; idPrefixes?: string[] })[];
}

export interface InstalledAddon {
  url: string;
  name?: string;
  enabled?: boolean;
  sort_order?: number;
  manifest?: AddonManifest;
  error?: string;
}

export interface ManagedAccount {
  id: string;
  name: string; // Friendly label (e.g. "Living Room TV" or "Remote Device")
  email: string;
  region?: string;
  notes?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  profiles?: UserProfile[];
  activeProfileId: number;
  lastSyncedAt?: string;
}

export interface UserProfile {
  id: number;
  name: string;
  isPrimary?: boolean;
  avatarColorHex?: string;
}

export interface EnrichedCatalogRow {
  key: string;
  addonId: string;
  addonName: string;
  addonBaseUrl: string;
  addonLogo?: string;
  catalogId: string;
  catalogName: string;
  customTitle: string;
  type: string;
  enabled: boolean;
  order: number;
  isCollection: boolean;
  collectionId: string;
}
