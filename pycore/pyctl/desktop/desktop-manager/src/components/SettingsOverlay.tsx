import { useEffect } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import SettingsPage from '../pages/SettingsPage';

/**
 * Global translucent floating Settings modal. Rendered once in the Shell (above
 * the active page) and shown whenever the Settings sidebar item is clicked.
 * Closes on backdrop click, the X button, or the Escape key.
 */
export default function SettingsOverlay() {
  const { settings, showSettings, closeSettings, t } = useApp();
  const dark = settings.theme === 'dark';

  // Close on Escape while the overlay is open.
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettings, closeSettings]);

  if (!showSettings) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={closeSettings}
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${
          dark ? 'bg-slate-900/95 border-white/10 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b backdrop-blur-xl ${
          dark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <h2 className="text-base font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-sky-400" /> {t.settings}
          </h2>
          <button
            onClick={closeSettings}
            aria-label={t.close}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <SettingsPage />
        </div>
      </div>
    </div>
  );
}
