import React from 'react';
import { ManagedAccount } from '../../types/nuvio';
import { Users, Globe, Trash2, Edit, Plus, ShieldCheck, Server } from 'lucide-react';

interface AccountSettingsViewProps {
  accounts: ManagedAccount[];
  activeAccount: ManagedAccount | null;
  onSelectAccount: (id: string) => void;
  onEditAccount: (account: ManagedAccount) => void;
  onDeleteAccount: (id: string) => void;
  onOpenAddModal: () => void;
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({
  accounts,
  activeAccount,
  onSelectAccount,
  onEditAccount,
  onDeleteAccount,
  onOpenAddModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Managed Family & Remote Accounts</h2>
          <p className="text-xs text-slate-400 mt-1">
            Store and quickly switch between Nuvio accounts you support remotely.
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const isActive = activeAccount?.id === acc.id;
          return (
            <div
              key={acc.id}
              className={`p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">{acc.name}</h3>
                    {acc.region && (
                      <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <Globe className="w-2.5 h-2.5 text-blue-400" />
                        <span>{acc.region}</span>
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{acc.email || 'No email specified'}</p>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onEditAccount(acc)}
                    title={`Edit ${acc.name}`}
                    aria-label={`Edit ${acc.name}`}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this account from this browser?')) {
                        onDeleteAccount(acc.id);
                      }
                    }}
                    title={`Delete ${acc.name}`}
                    aria-label={`Delete ${acc.name}`}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-500">
                    <Server className="w-3.5 h-3.5 mr-1.5" />
                    Supabase:
                  </span>
                  <span className="font-mono text-[11px] truncate max-w-[200px]">
                    {acc.supabaseUrl}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-500">
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Active Profile:
                  </span>
                  <span className="font-medium text-slate-200">
                    Profile {acc.activeProfileId}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Auth State:
                  </span>
                  <span className="text-emerald-400 font-medium">Authenticated</span>
                </div>
              </div>

              {!isActive && (
                <button
                  onClick={() => onSelectAccount(acc.id)}
                  className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Switch to this Account
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
