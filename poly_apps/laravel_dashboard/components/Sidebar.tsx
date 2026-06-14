import React from 'react';
import { ViewType, NavItem, Language } from '../types';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '../hooks/useUserRole';
import {
  Film,
  Code2,
  Wrench,
  Server,
  Settings,
  Rocket,
  BookOpen,
  Boxes,
  ListChecks,
  Network,
  Sparkles,
  BrainCircuit,
  KeyRound,
  DatabaseZap,
  Clapperboard
} from "lucide-react";

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  lang: Language;
}

const NAV_ITEMS: NavItem[] = [
  { id: ViewType.API_TESTER, icon: Server, labelKey: 'api' },
  { id: ViewType.MEDIA_BROWSER, icon: Film, labelKey: 'media' },
  { id: ViewType.MOVIES_BOOKS, icon: Clapperboard, labelKey: 'moviesBooks' },
  { id: ViewType.CODE_BROWSER, icon: Code2, labelKey: 'code' },
  { id: ViewType.TOOLS, icon: Wrench, labelKey: 'tools' },
  { id: ViewType.VOCABULARY, icon: BookOpen, labelKey: 'vocabulary' },
  { id: ViewType.AI_TOOLS, icon: Sparkles, labelKey: 'aiTools' },
  { id: ViewType.AI_MANAGEMENT, icon: BrainCircuit, labelKey: 'aiManagement' },
  { id: ViewType.MCP_MANAGER, icon: Boxes, labelKey: 'mcp' },
  // Unified Task Center replaced the separate Octane-timers + Global-tasks
  // entries; their ViewTypes still deep-link into its scheduler/queue tabs.
  { id: ViewType.TASK_CENTER, icon: ListChecks, labelKey: 'taskCenter' },
  { id: ViewType.SERVER_MANAGER, icon: Network, labelKey: 'server' },
  // Database Viewer was merged into Database Manager (Tables tab); the old
  // #/db-viewer slug deep-links there (see core/routing/viewRoute.ts).
  { id: ViewType.DATABASE_MANAGER, icon: DatabaseZap, labelKey: 'dbManager' },
  { id: ViewType.SETTINGS, icon: Settings, labelKey: 'settings' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: ViewType.INVITE_CODE_MANAGER, icon: KeyRound, labelKey: 'inviteCodes' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, lang }) => {
  const { t } = useTranslation();
  const { canManageInviteCodes } = useUserRole();

  const visibleNavItems = [
    ...NAV_ITEMS,
    ...(canManageInviteCodes ? ADMIN_NAV_ITEMS : [])
  ];

  return (
    <aside className="fixed left-0 top-0 w-14 md:w-16 h-screen flex flex-col items-center py-3 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md border-r border-black/5 dark:border-white/10 z-50 transition-colors duration-300">
      {/* Brand Logo / Rocket */}
      <div className="mb-4 p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
        <Rocket size={20} />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-1.5">
        {visibleNavItems.map((item) => {
          const isActive = activeView === item.id;
          const label = t(`nav.${item.labelKey}`);

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                group relative flex items-center justify-center w-full aspect-square rounded-lg transition-all duration-300
                ${isActive
                  ? 'bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-white/20 dark:to-white/5 text-indigo-600 dark:text-white shadow-lg border border-indigo-500/20 dark:border-white/20'
                  : 'text-slate-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}
              `}
              title={label}
            >
              <item.icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-105'}`} />

              {/* Active Indicator Line */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
              )}

              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-black/10 dark:border-white/10 pointer-events-none z-50 shadow-xl">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile/Status */}
      <div className="mt-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 border-2 border-white dark:border-slate-900 shadow-lg cursor-pointer hover:scale-105 transition-transform" />
      </div>
    </aside>
  );
};

export default Sidebar;