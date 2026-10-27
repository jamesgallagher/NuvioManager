import React from 'react';
import { ManagedAccount } from '../../types/nuvio';
import { Tv, Globe, Users, Plus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  accounts: ManagedAccount[];
  activeAccount: ManagedAccount | null;
  onSelectAccount: (accountId: string) => void;
  onOpenAddAccount: () => void;
  onSelectProfile: (profileId: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  status: 'idle' | 'syncing' | 'error' | 'success';
  statusMessage?: string;
}

export const Header: React.FC<HeaderProps> = ({
  accounts,
  activeAccount,
  onSelectAccount,
  onOpenAddAccount,
  onSelectProfile,
  onRefresh,
  isRefreshing,
  status,
  statusMessage,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
      <div className="flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white">Nuvio Remote Hub</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Support
              </span>
            </div>
            <p className="text-xs text-slate-400">Remote Catalog & Device Manager</p>
          </div>
        </div>

        {/* Center / Account Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 shadow-inner">
            <div className="flex items-center px-2.5 text-xs text-slate-400 font-medium">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              <span>Target:</span>
            </div>

            <select
              value={activeAccount?.id || ''}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  onOpenAddAccount();
                } else {
                  onSelectAccount(e.target.value);
                }
              }}
              className="bg-transparent text-sm text-slate-100 font-medium pr-8 py-1 pl-1 focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.name} {acc.region ? `(${acc.region})` : ''} - {acc.email || 'No email'}
                </option>
              ))}
              <option value="__add__" className="bg-slate-900 text-blue-400 font-semibold">
                + Add New Family / Person Account...
              </option>
            </select>

            <button
              onClick={onOpenAddAccount}
              title="Add Managed Account"
              aria-label="Add Managed Account"
              className="ml-1 p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Selector */}
          {activeAccount && (
            <div className="flex items-center bg-slate-800/80 rounded-xl px-2.5 py-1 border border-slate-700/60 text-xs">
              <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              <span className="text-slate-400 mr-2">Profile:</span>
              <select
                value={activeAccount.activeProfileId}
                onChange={(e) => onSelectProfile(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                {(activeAccount.profiles || [{ id: 1, name: 'Default', isPrimary: true }]).map(
                  (p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      Profile {p.id} ({p.name})
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </div>

        {/* Right Status & Refresh */}
        <div className="flex items-center space-x-3">
          {status === 'syncing' && (
            <span className="flex items-center text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 animate-pulse">
              <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
              Syncing to TV...
            </span>
          )}
          {status === 'success' && (
            <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              {statusMessage || 'Synced'}
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
              <AlertCircle className="w-3 h-3 mr-1.5" />
              {statusMessage || 'Sync failed'}
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing || !activeAccount}
            title="Refresh catalogs from remote"
            className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>
    </header>
  );
};
