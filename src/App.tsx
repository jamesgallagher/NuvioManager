import React, { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { ManagedAccount } from './types/nuvio';
import { useAccounts } from './hooks/useAccounts';
import { useRemoteData } from './hooks/useRemoteData';
import { useKeyHandoff } from './hooks/useKeyHandoff';
import { reasonToPlainEnglish } from './services/anonKey';
import { Header } from './components/layout/Header';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { CatalogManager } from './components/catalogs/CatalogManager';
import { AddonManager } from './components/addons/AddonManager';
import { AccountSettingsView } from './components/settings/AccountSettingsView';
import { GetKeyView } from './components/settings/GetKeyView';
import { AddAccountModal } from './components/accounts/AddAccountModal';
import { CollectionsView } from './components/collections/CollectionsView';
import { NoAccountPlaceholder } from './components/common/NoAccountPlaceholder';
import { LoadingPlaceholder } from './components/common/LoadingPlaceholder';

export const App: React.FC = () => {
  // The unsaved-changes guard is owned by useRemoteData; useAccounts needs it
  // to guard account/profile switches. A ref bridges the two hooks.
  const confirmDiscardRef = useRef<() => boolean>(() => true);

  const {
    accounts,
    activeAccount,
    selectAccount,
    selectProfile,
    saveAccount,
    deleteAccount,
    updateAccountTokens,
    updateProfiles,
  } = useAccounts({ confirmDiscardRef });

  // Memoised so useRemoteData's `load` stays stable across renders; the
  // auto-load effect keys on account id/profile only, and a token refresh must
  // not re-trigger it.
  const handleAccountUpdated = useCallback(
    (account: ManagedAccount) =>
      updateAccountTokens(
        account.id,
        account.accessToken ?? '',
        account.refreshToken ?? ''
      ),
    [updateAccountTokens]
  );

  const remote = useRemoteData(activeAccount, {
    onAccountUpdated: handleAccountUpdated,
    onProfilesLoaded: updateProfiles,
  });
  confirmDiscardRef.current = remote.confirmDiscard;

  const [activeTab, setActiveTab] = useState<ActiveTab>('catalogs');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);
  const [isGetKeyViewOpen, setIsGetKeyViewOpen] = useState(false);

  // Key handoff: if the URL fragment carries a key from the helper, validate
  // and save it, then remove the fragment. The banner reports the outcome.
  const { result: keyHandoffResult, dismiss: dismissKeyHandoff } = useKeyHandoff();

  const openAddAccountModal = () => {
    setEditingAccount(null);
    setIsAddAccountModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17]">
      {/* Header Bar */}
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={selectAccount}
        onOpenAddAccount={openAddAccountModal}
        onSelectProfile={selectProfile}
        onRefresh={remote.refresh}
        isRefreshing={remote.isLoading}
        status={remote.status}
        statusMessage={remote.statusMessage}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          catalogsCount={remote.catalogs.length}
          addonsCount={remote.addons.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full">
          {keyHandoffResult && (
            <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <span>
                {keyHandoffResult.ok
                  ? `Anon key saved (${keyHandoffResult.masked}). You can now sign in with just your email and password.`
                  : `That key was not accepted (${reasonToPlainEnglish(keyHandoffResult.reason)}).`}
              </span>
              <button
                onClick={dismissKeyHandoff}
                aria-label="Dismiss"
                className="p-1 text-blue-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!activeAccount ? (
            <NoAccountPlaceholder
              onAddAccount={openAddAccountModal}
              onGetKey={() => setIsGetKeyViewOpen(true)}
            />
          ) : remote.isLoading && remote.catalogs.length === 0 ? (
            <LoadingPlaceholder activeAccount={activeAccount} />
          ) : (
            <>
              {activeTab === 'catalogs' && (
                <CatalogManager
                  catalogs={remote.catalogs}
                  activeAccount={activeAccount}
                  hasUnsavedChanges={remote.hasUnsavedChanges}
                  isSaving={remote.isSaving}
                  onMove={remote.moveCatalog}
                  onToggleEnabled={remote.toggleCatalog}
                  onUpdateTitle={remote.updateTitle}
                  onEnableAll={remote.enableAll}
                  onDisableAll={remote.disableAll}
                  onResetOrder={remote.refresh}
                  onSaveToRemote={remote.pushCatalogs}
                />
              )}

              {activeTab === 'addons' && (
                <AddonManager
                  addons={remote.addons}
                  activeAccount={activeAccount}
                  onAddAddonUrl={remote.addAddon}
                  onToggleAddon={remote.toggleAddon}
                  onRemoveAddon={remote.removeAddon}
                  isLoading={remote.isLoading}
                />
              )}

              {activeTab === 'collections' && (
                <CollectionsView activeAccount={activeAccount} />
              )}

              {activeTab === 'settings' && (
                <AccountSettingsView
                  accounts={accounts}
                  activeAccount={activeAccount}
                  onSelectAccount={selectAccount}
                  onEditAccount={(acc) => {
                    setEditingAccount(acc);
                    setIsAddAccountModalOpen(true);
                  }}
                  onDeleteAccount={deleteAccount}
                  onOpenAddModal={openAddAccountModal}
                  onGetKey={() => setIsGetKeyViewOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Add / Edit Account Modal. Mounted only while open so its fields start
          from the current saved key and the account being edited each time. */}
      {isAddAccountModalOpen && (
        <AddAccountModal
          isOpen
          onClose={() => {
            setIsAddAccountModalOpen(false);
            setEditingAccount(null);
          }}
          onSaveAccount={saveAccount}
          initialAccount={editingAccount}
          onGetKey={() => setIsGetKeyViewOpen(true)}
        />
      )}

      {/* Get the key view */}
      <GetKeyView
        isOpen={isGetKeyViewOpen}
        onClose={() => setIsGetKeyViewOpen(false)}
      />
    </div>
  );
};
