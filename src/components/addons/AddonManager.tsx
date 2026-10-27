import React, { useState } from 'react';
import { InstalledAddon, ManagedAccount } from '../../types/nuvio';
import { Plus, Trash2, Globe, AlertCircle, Loader2, Power } from 'lucide-react';

interface AddonManagerProps {
  addons: InstalledAddon[];
  activeAccount: ManagedAccount | null;
  onAddAddonUrl: (url: string) => Promise<void>;
  onToggleAddon: (url: string) => Promise<void>;
  onRemoveAddon: (url: string) => Promise<void>;
  isLoading?: boolean;
}

export const AddonManager: React.FC<AddonManagerProps> = ({
  addons,
  activeAccount,
  onAddAddonUrl,
  onToggleAddon,
  onRemoveAddon,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setError(null);
    setAdding(true);
    try {
      await onAddAddonUrl(newUrl.trim());
      setNewUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to install addon.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Installed Remote Addons</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage Stremio-compatible media addons for{' '}
            <span className="text-blue-400 font-semibold">{activeAccount?.name}</span> (Profile{' '}
            {activeAccount?.activeProfileId}).
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
          {addons.length} Addons Active
        </span>
      </div>

      {/* Add Addon Input */}
      <form onSubmit={handleAdd} className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold text-slate-300">
          Install Stremio Addon via URL
        </label>
        <div className="flex items-center space-x-3">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="url"
              placeholder="https://example.com/manifest.json or stremio://..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newUrl.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-lg shadow-blue-500/20"
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Install</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-xs text-rose-400 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Addons List */}
      <div className="space-y-3">
        {addons.map((addon, index) => (
          <div
            key={addon.url}
            className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
              addon.enabled !== false
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-slate-900/30 border-slate-800/60 opacity-60'
            }`}
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              {addon.manifest?.logo ? (
                <img
                  src={addon.manifest.logo}
                  alt=""
                  className="w-9 h-9 rounded-xl object-contain bg-slate-800 p-1 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 font-bold text-xs">
                  #{index + 1}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {addon.manifest?.name || addon.name || addon.url}
                  </h4>
                  {addon.manifest?.version && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      v{addon.manifest.version}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 truncate max-w-xl font-mono mt-0.5">
                  {addon.url}
                </p>

                {addon.manifest?.catalogs && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Provides {addon.manifest.catalogs.length} catalogs:{' '}
                    {addon.manifest.catalogs.map((c) => c.name || c.id).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => onToggleAddon(addon.url)}
                title={addon.enabled !== false ? 'Disable Addon' : 'Enable Addon'}
                className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                  addon.enabled !== false
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                onClick={() => onRemoveAddon(addon.url)}
                title="Uninstall Addon"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
