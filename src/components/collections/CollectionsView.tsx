import React from 'react';
import { ManagedAccount } from '../../types/nuvio';
import { useRemoteCollections } from '../../hooks/useRemoteCollections';
import { FolderHeart, Loader2, RefreshCw, Pin } from 'lucide-react';

interface CollectionsViewProps {
  activeAccount: ManagedAccount | null;
  onAccountUpdated?: (account: ManagedAccount) => void;
}

/**
 * Read-only view of the profile's collections. Collections are created and
 * edited on the TV; rows for them can be shown, hidden, reordered and renamed
 * in the Home Catalogs tab.
 */
export const CollectionsView: React.FC<CollectionsViewProps> = ({
  activeAccount,
  onAccountUpdated,
}) => {
  const { collections, isLoading, error, reload } = useRemoteCollections(
    activeAccount,
    onAccountUpdated ?? (() => {})
  );

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Collections</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Collection folders group catalogs into custom rows on {activeAccount?.name}&apos;s TV.
            This view is read only. Create and edit collections on the TV; show, hide, reorder and
            rename their rows in the Home Catalogs tab.
          </p>
        </div>
        <button
          onClick={reload}
          disabled={isLoading}
          aria-label="Reload collections"
          title="Reload collections"
          className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {isLoading && collections.length === 0 && !error && (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading collections...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300"
        >
          {error}
        </div>
      )}

      {!isLoading && !error && collections.length === 0 && (
        <div className="bg-slate-900/60 p-8 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
          No collections for this profile yet.
        </div>
      )}

      {collections.map((collection) => (
        <div
          key={collection.id}
          className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800"
        >
          <div className="flex items-center space-x-2">
            <FolderHeart className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white">{collection.title}</h4>
            {collection.pinToTop && (
              <span className="flex items-center text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                <Pin className="w-3 h-3 mr-1" />
                Pinned to top
              </span>
            )}
            <span className="text-[11px] text-slate-500">
              {collection.folders.length} {collection.folders.length === 1 ? 'folder' : 'folders'}
            </span>
          </div>
          {collection.folders.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {collection.folders.map((folder) => (
                <li
                  key={folder.id}
                  className="flex items-center justify-between text-xs bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2"
                >
                  <span className="text-slate-200 truncate">{folder.title}</span>
                  <span className="text-slate-500 ml-2 shrink-0">
                    {folder.sourceCount} {folder.sourceCount === 1 ? 'source' : 'sources'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};
