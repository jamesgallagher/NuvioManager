import React from 'react';
import { ManagedAccount } from '../../types/nuvio';
import { Loader2 } from 'lucide-react';

interface LoadingPlaceholderProps {
  activeAccount: ManagedAccount | null;
}

/**
 * Shown while remote data is being loaded for the active account. Markup and
 * classes unchanged from the original inline block in App.tsx.
 */
export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({ activeAccount }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
      <h3 className="text-base font-semibold text-slate-200">
        Connecting to {activeAccount?.name || 'Nuvio'}...
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Fetching addon manifests and catalog layout from Supabase
      </p>
    </div>
  );
};
