import React, { useState } from 'react';
import { EnrichedCatalogRow } from '../../types/nuvio';
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Eye,
  EyeOff,
  Edit2,
  Check,
  Film,
  Tv,
  FolderHeart,
  Layers,
} from 'lucide-react';

interface CatalogCardProps {
  catalog: EnrichedCatalogRow;
  index: number;
  totalCount: number;
  onMove: (fromIndex: number, toIndex: number) => void;
  onToggleEnabled: (key: string) => void;
  onUpdateTitle: (key: string, title: string) => void;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  catalog,
  index,
  totalCount,
  onMove,
  onToggleEnabled,
  onUpdateTitle,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(catalog.customTitle || catalog.catalogName);

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  const handleSaveTitle = () => {
    onUpdateTitle(catalog.key, editedTitle.trim());
    setIsEditingTitle(false);
  };

  const getTypeIcon = () => {
    if (catalog.isCollection) return <FolderHeart className="w-3.5 h-3.5 text-pink-400" />;
    const t = catalog.type.toLowerCase();
    if (t.includes('movie')) return <Film className="w-3.5 h-3.5 text-amber-400" />;
    if (t.includes('series') || t.includes('tv') || t.includes('show'))
      return <Tv className="w-3.5 h-3.5 text-sky-400" />;
    return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div
      className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-150 ${
        catalog.enabled
          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20'
          : 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:opacity-80'
      }`}
    >
      {/* Left: Reorder Controls + Index Badge */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="flex flex-col space-y-0.5">
          <div className="flex space-x-0.5">
            <button
              onClick={() => onMove(index, 0)}
              disabled={isFirst}
              title="Send to Top"
              aria-label="Send to Top"
              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onMove(index, index - 1)}
              disabled={isFirst}
              title="Move Up"
              aria-label="Move Up"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 rounded transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex space-x-0.5">
            <button
              onClick={() => onMove(index, totalCount - 1)}
              disabled={isLast}
              title="Send to Bottom"
              aria-label="Send to Bottom"
              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onMove(index, index + 1)}
              disabled={isLast}
              title="Move Down"
              aria-label="Move Down"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 rounded transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="w-7 h-7 rounded-lg bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-xs font-mono font-bold text-slate-300">
          {index + 1}
        </div>
      </div>

      {/* Center: Addon & Catalog Details */}
      <div className="flex-1 min-w-0 mx-4">
        <div className="flex items-center space-x-2">
          {/* Addon Logo or Icon */}
          {catalog.addonLogo ? (
            <img
              src={catalog.addonLogo}
              alt=""
              className="w-4 h-4 rounded object-contain shrink-0"
            />
          ) : (
            <div className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center shrink-0">
              {getTypeIcon()}
            </div>
          )}

          <span className="text-xs text-slate-400 font-medium truncate">
            {catalog.addonName}
          </span>

          <span className="text-slate-600">•</span>

          <span className="flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 uppercase tracking-wider">
            {getTypeIcon()}
            <span>{catalog.type}</span>
          </span>

          {catalog.customTitle && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
              Renamed
            </span>
          )}

          {!catalog.enabled && (
            <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-medium">
              Hidden on TV
            </span>
          )}
        </div>

        {/* Catalog Title / Inline Editor */}
        <div className="mt-1 flex items-center space-x-2">
          {isEditingTitle ? (
            <div className="flex items-center space-x-2 w-full max-w-md">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                placeholder={catalog.catalogName}
                className="w-full px-2.5 py-1 text-sm bg-slate-800 border border-blue-500 rounded-lg text-white focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                title="Save catalog name"
                aria-label="Save catalog name"
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-slate-100 truncate">
                {catalog.customTitle || catalog.catalogName}
              </h3>
              <button
                onClick={() => {
                  setEditedTitle(catalog.customTitle || catalog.catalogName);
                  setIsEditingTitle(true);
                }}
                title="Rename catalog row on TV"
                aria-label="Rename catalog row on TV"
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-300 transition-opacity"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Visibility Switch */}
      <div className="flex items-center space-x-3 shrink-0">
        <button
          onClick={() => onToggleEnabled(catalog.key)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            catalog.enabled
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
          }`}
        >
          {catalog.enabled ? (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Visible</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Hidden</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
