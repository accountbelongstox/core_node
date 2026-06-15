import { useState, type MouseEvent } from 'react';
import { useApp } from '../state/AppContext';
import { PAGES, type PageDef } from '../pages/registry';

/**
 * One sidebar rail item. The tooltip is driven by React hover state (not pure CSS
 * :hover) and is force-cleared on click — this fixes the bug where the tip label
 * lingered after selecting a tab (in the webview, :hover stays active after a
 * click without mouse movement, so a CSS-only tooltip never hid).
 */
function SidebarItem({ page }: { page: PageDef }) {
  const { activeTab, setActiveTab, showSettings, openSettings, t } = useApp();
  const [hovered, setHovered] = useState(false);
  const Icon = page.icon;
  // Settings is a global floating overlay, not a routed page: it is "active"
  // while the overlay is open, and clicking it opens the overlay.
  const isSettings = page.id === 'settings';
  const active = isSettings ? showSettings : activeTab === page.id;

  const select = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSettings) openSettings();
    else setActiveTab(page.id);
    setHovered(false);              // hide tooltip immediately on click
    e.currentTarget.blur();        // drop focus so nothing keeps it visible
  };

  return (
    <button
      onClick={select}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={t[page.labelKey]}
      className={`relative p-3 rounded-xl border transition-all cursor-pointer ${page.bottom ? 'mt-auto' : ''} ${
        active ? 'bg-sky-500/25 border-sky-500/40 text-sky-400 shadow-md'
          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white border-transparent'}`}
    >
      <Icon className="w-5 h-5" />
      {/* Tooltip: only while hovered AND not the active item */}
      {hovered && !active && (
        <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-950 text-white text-[10px] font-semibold rounded z-50 whitespace-nowrap pointer-events-none shadow-lg">
          {t[page.labelKey]}
        </span>
      )}
    </button>
  );
}

export default function Sidebar() {
  const { settings } = useApp();
  return (
    <aside className={`w-20 border-r py-8 gap-6 flex flex-col items-center transition-colors ${
      settings.theme === 'dark' ? 'border-white/5 bg-[#08080a]/60 backdrop-blur-xl' : 'border-slate-200 bg-white/60 backdrop-blur-xl'}`}>
      {PAGES.map((page) => <SidebarItem key={page.id} page={page} />)}
    </aside>
  );
}
