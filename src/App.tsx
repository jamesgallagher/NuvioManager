import React, { useState, useRef } from 'react';
import { ManagedAccount } from './types/nuvio';
import { useAccounts } from './hooks/useAccounts';
import { useRemoteData } from './hooks/useRemoteData';
import { Header } from './components/layout/Header';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { CatalogManager } from './components/catalogs/CatalogManager';
import { AddonManager } from './components/addons/AddonManager';
import { AccountSettingsView } from './components/settings/AccountSettingsView';
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
  } = useAccounts({ confirmDiscardRef });

  const remote = useRemoteData(activeAccount);
  confirmDiscardRef.current = remote.confirmDiscard;

  const [activeTab, setActiveTab] = useState<ActiveTab>('catalogs');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);

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
          {!activeAccount ? (
            <NoAccountPlaceholder onAddAccount={openAddAccountModal} />
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
        onSaveAccount={saveAccount}
        initialAccount={editingAccount}
      />
    </div>
  );
};
