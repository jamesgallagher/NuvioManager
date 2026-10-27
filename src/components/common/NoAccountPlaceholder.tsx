import React from 'react';
import { Plus } from 'lucide-react';

interface NoAccountPlaceholderProps {
  onAddAccount: () => void;
  onGetKey: () => void;
}

/**
 * Shown when no managed account is selected. Markup and classes unchanged
 * from the original inline block in App.tsx.
 */
export const NoAccountPlaceholder: React.FC<NoAccountPlaceholderProps> = ({
  onAddAccount,
  onGetKey,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-slate-900/40 rounded-2xl border border-slate-800">
      <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
        <Plus className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-white">No Managed Account Selected</h3>
      <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
        Connect a Nuvio account to start managing its catalog order, visible rows, and addons remotely.
      </p>
      <button
        onClick={onAddAccount}
        className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Add Your First Account</span>
      </button>
      <button
        onClick={onGetKey}
        className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
      >
        Need the Nuvio key? Get it automatically
      </button>
    </div>
  );
};
