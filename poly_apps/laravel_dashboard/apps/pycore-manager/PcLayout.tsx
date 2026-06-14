/**
 * pycore-manager layout: a left icon sidebar (driven by the page registry) + the
 * active page via <Outlet/>. Pycore theme glass surfaces; works light + dark.
 * Global chrome: top bar (Laravel endpoint, clears shell dock gutter) + bottom log.
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';
import { PC_PAGES } from './pcPages';
import { PcFloatingLog } from './PcFloatingLog';
import { PcTopBar } from './components/PcTopBar';

const linkBase =
  'group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150';

export const PcLayout: React.FC = () => {
  const { t } = useTranslation('pc');
  const top = PC_PAGES.filter((p) => !p.bottom);
  const bottom = PC_PAGES.filter((p) => p.bottom);

  const renderLink = (p: typeof PC_PAGES[number]) => {
    const Icon = p.Icon;
    return (
      <NavLink
        key={p.id}
        to={`/pycore-manager/${p.id}`}
        className={({ isActive }) =>
          `${linkBase} ${isActive
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold shadow-sm ring-1 ring-inset ring-indigo-500/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-slate-200'}`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-indigo-500 transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{t(p.labelKey)}</span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden" data-end="pycore-manager">
      <aside className="w-56 shrink-0 h-full flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <div className="shrink-0 px-4 py-4 flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-semibold tracking-tight">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/20">
            <Cpu className="w-4.5 h-4.5 text-indigo-500" />
          </span>
          {t('appTitle')}
        </div>
        <nav className="flex-1 min-h-0 px-2 space-y-1 overflow-y-auto overscroll-contain">{top.map(renderLink)}</nav>
        <div className="shrink-0 px-2 py-2 border-t border-slate-200/80 dark:border-slate-800/80 space-y-1">
          {bottom.map(renderLink)}
        </div>
      </aside>
      <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        <PcTopBar />
        {/* Reserve bottom space for the collapsed floating log (~56px). */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-16">
          <Outlet />
        </div>
      </main>
      {/* Global floating live-log: present on every pycore page. */}
      <PcFloatingLog />
    </div>
  );
};

export default PcLayout;
