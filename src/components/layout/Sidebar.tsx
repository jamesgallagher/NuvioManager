import React from 'react';
import { LayoutGrid, Puzzle, FolderHeart, Settings, ShieldCheck, HelpCircle } from 'lucide-react';
import { versionLabel } from '../../version';

export type ActiveTab = 'catalogs' | 'addons' | 'collections' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  catalogsCount: number;
  addonsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  catalogsCount,
  addonsCount,
}) => {
  const navItems = [
    {
      id: 'catalogs' as ActiveTab,
      label: 'Home Catalogs',
      description: 'Show, hide & re-order',
      icon: LayoutGrid,
      badge: catalogsCount > 0 ? catalogsCount : undefined,
    },
    {
      id: 'addons' as ActiveTab,
      label: 'Addon Manager',
      description: 'Remote Stremio addons',
      icon: Puzzle,
      badge: addonsCount > 0 ? addonsCount : undefined,
    },
    {
      id: 'collections' as ActiveTab,
      label: 'Collections',
      description: 'Custom media folders',
      icon: FolderHeart,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Accounts & Sync',
      description: 'Credentials & endpoints',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Management
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-medium border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <div>
                  <div className="text-sm leading-none">{item.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{item.description}</div>
                </div>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Nuvio Sync Verified</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Pushed changes sync automatically whenever the TV app opens or restarts.
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span title={`Nuvio Manager ${versionLabel()}`}>{versionLabel()} • Remote Hub</span>
          <span className="flex items-center hover:text-slate-400 cursor-pointer">
            <HelpCircle className="w-3 h-3 mr-1" />
            Help
          </span>
        </div>
      </div>
    </aside>
  );
};
