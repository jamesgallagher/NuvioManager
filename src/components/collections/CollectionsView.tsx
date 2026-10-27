import React from 'react';
import { ManagedAccount } from '../../types/nuvio';

interface CollectionsViewProps {
  activeAccount: ManagedAccount | null;
}

/**
 * Placeholder for the Collections tab. The Collections tab stays a
 * placeholder (see card 5.6); this is the existing markup moved unchanged.
 */
export const CollectionsView: React.FC<CollectionsViewProps> = ({ activeAccount }) => {
  return (
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
  );
};
