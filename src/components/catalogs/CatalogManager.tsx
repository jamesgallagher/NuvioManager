import React, { useState, useMemo } from 'react';
import { EnrichedCatalogRow, ManagedAccount } from '../../types/nuvio';
import { CatalogCard } from './CatalogCard';
import {
  Search,
  Eye,
  EyeOff,
  RotateCcw,
  UploadCloud,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';

interface CatalogManagerProps {
  catalogs: EnrichedCatalogRow[];
  activeAccount: ManagedAccount | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onToggleEnabled: (key: string) => void;
  onUpdateTitle: (key: string, title: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onResetOrder: () => void;
  onSaveToRemote: () => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  catalogs,
  activeAccount,
  hasUnsavedChanges,
  isSaving,
  onMove,
  onToggleEnabled,
  onUpdateTitle,
  onEnableAll,
  onDisableAll,
  onResetOrder,
  onSaveToRemote,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddon, setSelectedAddon] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  // Addon list for filter dropdown
  const uniqueAddons = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalogs) {
      if (c.addonId) map.set(c.addonId, c.addonName);
    }
    return Array.from(map.entries());
  }, [catalogs]);

  // Unique types
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalogs) {
      if (c.type) set.add(c.type);
    }
    return Array.from(set);
  }, [catalogs]);

  // Filtered catalogs
  const filteredCatalogs = useMemo(() => {
    return catalogs.filter((c) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        c.catalogName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.addonName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Addon filter
      if (selectedAddon !== 'all' && c.addonId !== selectedAddon) return false;

      // Type filter
      if (selectedType !== 'all' && c.type !== selectedType) return false;

      // Status filter
      if (statusFilter === 'visible' && !c.enabled) return false;
      if (statusFilter === 'hidden' && c.enabled) return false;

      return true;
    });
  }, [catalogs, searchQuery, selectedAddon, selectedType, statusFilter]);

  const visibleCount = useMemo(() => catalogs.filter((c) => c.enabled).length, [catalogs]);
  const hiddenCount = catalogs.length - visibleCount;

  return (
    <div className="space-y-6">
      {/* Top Banner: Unsaved changes or Remote Status */}
      {hasUnsavedChanges && (
        <div className="sticky -top-8 z-20 flex items-center justify-between p-4 rounded-2xl bg-[#1d1a13] border border-amber-500/30 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                You have unsaved catalog modifications
              </h4>
              <p className="text-xs text-amber-300/80">
                Changes will not appear on{' '}
                <strong className="text-white">{activeAccount?.name || 'the TV'}</strong> until you
                push them.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onResetOrder}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-700 transition-colors"
            >
              Reset
            </button>

            <button
              onClick={onSaveToRemote}
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Pushing to Supabase...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Push Changes to TV</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Control Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Home Catalog Layout</h2>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                {visibleCount} Visible
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                {hiddenCount} Hidden
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure exactly which catalog rows show up on{' '}
            <span className="text-blue-400 font-semibold">{activeAccount?.name}</span>'s TV and in
            what order.
          </p>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onEnableAll}
            title="Make all catalogs visible"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Show All</span>
          </button>

          <button
            onClick={onDisableAll}
            title="Hide all catalogs"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl border border-slate-700/80 transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide All</span>
          </button>

          <button
            onClick={onResetOrder}
            title="Reset to default manifest ordering"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/80 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search catalog or addon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Addon Filter */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedAddon}
            onChange={(e) => setSelectedAddon(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Addons ({uniqueAddons.length})</option>
            {uniqueAddons.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility Filter */}
        <div className="flex items-center space-x-1 p-0.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('visible')}
            className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'visible'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Visible
          </button>
          <button
            onClick={() => setStatusFilter('hidden')}
            className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'hidden'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Hidden
          </button>
        </div>
      </div>

      {/* Catalog List */}
      {filteredCatalogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
          <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No matching catalogs found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCatalogs.map((catalog, filteredIndex) => {
            // Find true index in master array for accurate ordering
            const masterIndex = catalogs.findIndex((c) => c.key === catalog.key);
            return (
              <CatalogCard
                key={catalog.key}
                catalog={catalog}
                index={masterIndex >= 0 ? masterIndex : filteredIndex}
                totalCount={catalogs.length}
                onMove={onMove}
                onToggleEnabled={onToggleEnabled}
                onUpdateTitle={onUpdateTitle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
