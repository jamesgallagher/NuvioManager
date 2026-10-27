import React, { useState, useEffect, useCallback } from 'react';
import { EnrichedCatalogRow, InstalledAddon, ManagedAccount, SyncHomeCatalogPayload } from './types/nuvio';
import {
  loadAccounts,
  saveAccounts,
  getActiveAccountId,
  setActiveAccountId,
} from './services/accountStorage';
import { getSupabaseClient } from './services/supabaseClient';
import {
  pullRemoteCatalogSettings,
  pushRemoteCatalogSettings,
  enrichCatalogs,
  buildSyncPayload,
  fetchAddonManifest,
} from './services/catalogService';
import { fetchRemoteAddons, pushRemoteAddons } from './services/addonService';

import { Header } from './components/layout/Header';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { CatalogManager } from './components/catalogs/CatalogManager';
import { AddonManager } from './components/addons/AddonManager';
import { AccountSettingsView } from './components/settings/AccountSettingsView';
import { AddAccountModal } from './components/accounts/AddAccountModal';

import { Loader2, Plus } from 'lucide-react';

export const App: React.FC = () => {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<ManagedAccount | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalogs');

  // Catalogs & Addons state
  const [catalogs, setCatalogs] = useState<EnrichedCatalogRow[]>([]);
  const [addons, setAddons] = useState<InstalledAddon[]>([]);
  const [remotePayload, setRemotePayload] = useState<SyncHomeCatalogPayload | null>(null);
  const [baselineCatalogSignature, setBaselineCatalogSignature] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Modals
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);

  // Initialize accounts
  useEffect(() => {
    const loaded = loadAccounts();
    setAccounts(loaded);
    if (loaded.length > 0) {
      const activeId = getActiveAccountId();
      const current = loaded.find((a) => a.id === activeId) || loaded[0];
      setActiveAccount(current);
    } else {
      setActiveAccount(null);
    }
  }, []);

  // Save accounts when modified
  const handleUpdateAccounts = (newAccounts: ManagedAccount[]) => {
    setAccounts(newAccounts);
    saveAccounts(newAccounts);
  };

  // Switch Active Account
  const handleSelectAccount = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) {
      setActiveAccount(acc);
      setActiveAccountId(acc.id);
    }
  };

  // Switch Active Profile for active account
  const handleSelectProfile = (profileId: number) => {
    if (!activeAccount) return;
    const updated = { ...activeAccount, activeProfileId: profileId };
    setActiveAccount(updated);
    const newAccounts = accounts.map((a) => (a.id === updated.id ? updated : a));
    handleUpdateAccounts(newAccounts);
  };

  // Load Catalogs and Addons for active account and profile
  const loadData = useCallback(async () => {
    if (!activeAccount) return;

    setIsLoading(true);
    setStatus('idle');
    try {
      const client = getSupabaseClient(
        activeAccount.supabaseUrl,
        activeAccount.supabaseAnonKey,
        activeAccount.accessToken
      );

      // 1. Fetch installed addons
      let fetchedAddons: InstalledAddon[] = [];
      try {
        fetchedAddons = await fetchRemoteAddons(
          client,
          activeAccount.activeProfileId,
          activeAccount.userId
        );
      } catch (e) {
        console.warn('Could not load addons from table, using fallback defaults:', e);
        // Fallback default cinemeta manifest if empty/demo
        try {
          const defaultManifest = await fetchAddonManifest(
            'https://v3-cinemeta.strem.io/manifest.json'
          );
          fetchedAddons = [
            {
              url: 'https://v3-cinemeta.strem.io/manifest.json',
              name: 'Cinemeta',
              enabled: true,
              sort_order: 0,
              manifest: defaultManifest,
            },
          ];
        } catch {}
      }
      setAddons(fetchedAddons);

      // 2. Fetch remote catalog layout
      const remotePayload = await pullRemoteCatalogSettings(client, activeAccount.activeProfileId);
      setRemotePayload(remotePayload);

      // 3. Synthesize enriched rows
      const enriched = enrichCatalogs(fetchedAddons, remotePayload);
      setCatalogs(enriched);

      const sig = JSON.stringify(
        enriched.map((e) => ({ k: e.key, en: e.enabled, o: e.order, t: e.customTitle }))
      );
      setBaselineCatalogSignature(sig);

      setStatus('success');
      setStatusMessage('Catalogs Loaded');
    } catch (err: any) {
      console.error('Failed to load remote data', err);
      setStatus('error');
      setStatusMessage(err.message || 'Error fetching from Supabase');
    } finally {
      setIsLoading(false);
    }
  }, [activeAccount]);

  useEffect(() => {
    if (activeAccount) {
      loadData();
    }
  }, [activeAccount?.id, activeAccount?.activeProfileId, loadData]);

  // Check if there are unsaved catalog changes
  const currentCatalogSignature = JSON.stringify(
    catalogs.map((e) => ({ k: e.key, en: e.enabled, o: e.order, t: e.customTitle }))
  );
  const hasUnsavedChanges =
    baselineCatalogSignature !== '' && currentCatalogSignature !== baselineCatalogSignature;

  // Catalog reordering
  const handleMoveCatalog = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= catalogs.length) return;
    const updated = [...catalogs];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    // re-index order
    const reindexed = updated.map((item, idx) => ({ ...item, order: idx }));
    setCatalogs(reindexed);
  };

  // Toggle enable / disable
  const handleToggleCatalog = (key: string) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // Rename custom title
  const handleUpdateTitle = (key: string, title: string) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, customTitle: title } : c))
    );
  };

  // Bulk actions
  const handleEnableAll = () => {
    setCatalogs((prev) => prev.map((c) => ({ ...c, enabled: true })));
  };

  const handleDisableAll = () => {
    setCatalogs((prev) => prev.map((c) => ({ ...c, enabled: false })));
  };

  const handleResetOrder = () => {
    if (activeAccount) {
      loadData();
    }
  };

  // Save to remote Supabase via sync_push_home_catalog_settings
  const handleSaveToRemote = async () => {
    if (!activeAccount) return;
    setIsSaving(true);
    setStatus('syncing');

    try {
      const client = getSupabaseClient(
        activeAccount.supabaseUrl,
        activeAccount.supabaseAnonKey,
        activeAccount.accessToken
      );

      const payload = buildSyncPayload(catalogs, remotePayload);
      await pushRemoteCatalogSettings(client, activeAccount.activeProfileId, payload);

      setRemotePayload(payload);
      setBaselineCatalogSignature(currentCatalogSignature);
      setStatus('success');
      setStatusMessage('Pushed to TV successfully!');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err: any) {
      console.error('Failed to push catalog settings:', err);
      setStatus('error');
      setStatusMessage(err.message || 'Push failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Addon operations
  const handleAddAddonUrl = async (url: string) => {
    if (!activeAccount) return;
    const manifest = await fetchAddonManifest(url);
    const newAddon: InstalledAddon = {
      url,
      name: manifest.name,
      enabled: true,
      sort_order: addons.length,
      manifest,
    };
    const updated = [...addons, newAddon];
    setAddons(updated);

    const client = getSupabaseClient(
      activeAccount.supabaseUrl,
      activeAccount.supabaseAnonKey,
      activeAccount.accessToken
    );
    await pushRemoteAddons(client, activeAccount.activeProfileId, updated);
    loadData();
  };

  const handleToggleAddon = async (url: string) => {
    if (!activeAccount) return;
    const updated = addons.map((a) => (a.url === url ? { ...a, enabled: !a.enabled } : a));
    setAddons(updated);

    const client = getSupabaseClient(
      activeAccount.supabaseUrl,
      activeAccount.supabaseAnonKey,
      activeAccount.accessToken
    );
    await pushRemoteAddons(client, activeAccount.activeProfileId, updated);
  };

  const handleRemoveAddon = async (url: string) => {
    if (!activeAccount) return;
    const updated = addons.filter((a) => a.url !== url);
    setAddons(updated);

    const client = getSupabaseClient(
      activeAccount.supabaseUrl,
      activeAccount.supabaseAnonKey,
      activeAccount.accessToken
    );
    await pushRemoteAddons(client, activeAccount.activeProfileId, updated);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17]">
      {/* Header Bar */}
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={handleSelectAccount}
        onOpenAddAccount={() => {
          setEditingAccount(null);
          setIsAddAccountModalOpen(true);
        }}
        onSelectProfile={handleSelectProfile}
        onRefresh={loadData}
        isRefreshing={isLoading}
        status={status}
        statusMessage={statusMessage}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          catalogsCount={catalogs.length}
          addonsCount={addons.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full">
          {!activeAccount ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-slate-900/40 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Managed Account Selected</h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
                Connect a Nuvio account to start managing its catalog order, visible rows, and addons remotely.
              </p>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setIsAddAccountModalOpen(true);
                }}
                className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Account</span>
              </button>
            </div>
          ) : isLoading && catalogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-base font-semibold text-slate-200">
                Connecting to {activeAccount?.name || 'Nuvio'}...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Fetching addon manifests and catalog layout from Supabase
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'catalogs' && (
                <CatalogManager
                  catalogs={catalogs}
                  activeAccount={activeAccount}
                  hasUnsavedChanges={hasUnsavedChanges}
                  isSaving={isSaving}
                  onMove={handleMoveCatalog}
                  onToggleEnabled={handleToggleCatalog}
                  onUpdateTitle={handleUpdateTitle}
                  onEnableAll={handleEnableAll}
                  onDisableAll={handleDisableAll}
                  onResetOrder={handleResetOrder}
                  onSaveToRemote={handleSaveToRemote}
                />
              )}

              {activeTab === 'addons' && (
                <AddonManager
                  addons={addons}
                  activeAccount={activeAccount}
                  onAddAddonUrl={handleAddAddonUrl}
                  onToggleAddon={handleToggleAddon}
                  onRemoveAddon={handleRemoveAddon}
                  isLoading={isLoading}
                />
              )}

              {activeTab === 'collections' && (
                <div className="bg-slate-900/60 p-8 rounded-2xl border border-slate-800 text-center">
                  <h3 className="text-base font-bold text-white">Collections Hub</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Remote collection folders allow you to group custom movies, series, or lists
                    into custom rows on {activeAccount?.name}'s TV.
                  </p>
                  <p className="text-xs text-blue-400 mt-4 font-medium">
                    (Collections are also manageable within the Home Catalogs tab above!)
                  </p>
                </div>
              )}

              {activeTab === 'settings' && (
                <AccountSettingsView
                  accounts={accounts}
                  activeAccount={activeAccount}
                  onSelectAccount={handleSelectAccount}
                  onEditAccount={(acc) => {
                    setEditingAccount(acc);
                    setIsAddAccountModalOpen(true);
                  }}
                  onDeleteAccount={(id) => {
                    const remaining = accounts.filter((a) => a.id !== id);
                    handleUpdateAccounts(remaining);
                    if (activeAccount?.id === id) {
                      setActiveAccount(remaining[0] || null);
                    }
                  }}
                  onOpenAddModal={() => {
                    setEditingAccount(null);
                    setIsAddAccountModalOpen(true);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Add / Edit Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => {
          setIsAddAccountModalOpen(false);
          setEditingAccount(null);
        }}
        onSaveAccount={(saved) => {
          const exists = accounts.some((a) => a.id === saved.id);
          const updated = exists
            ? accounts.map((a) => (a.id === saved.id ? saved : a))
            : [...accounts, saved];
          handleUpdateAccounts(updated);
          setActiveAccount(saved);
        }}
        initialAccount={editingAccount}
      />
    </div>
  );
};
