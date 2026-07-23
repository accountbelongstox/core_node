import React, { useState } from 'react';
import { Check, Layers3, X } from 'lucide-react';
import { flavorAssetUrl, type FlavorConfig } from './flavor';

interface FloatingAppSwitcherProps {
  active: FlavorConfig;
  apps: FlavorConfig[];
  visible: boolean;
  onSelect: (app: FlavorConfig) => void;
}

export const FloatingAppSwitcher: React.FC<FloatingAppSwitcherProps> = ({
  active,
  apps,
  visible,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  if (!visible || apps.length < 2) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[1000] flex flex-col items-end gap-2">
      {open && (
        <div className="w-64 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 p-2 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Switch app</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close app switcher"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 space-y-1">
            {apps.map((app) => {
              const iconUrl = flavorAssetUrl(app, 'icon');
              const selected = app.id === active.id;
              return (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => {
                    onSelect(app);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/10"
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt="" className="h-9 w-9 rounded-xl" />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/20 text-sm font-bold">
                      {app.shortName?.[0] ?? app.name[0]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{app.name}</span>
                    <span className="block truncate text-xs text-slate-500">{app.description}</span>
                  </span>
                  {selected && <Check size={17} className="text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-indigo-600 text-white shadow-xl hover:bg-indigo-500"
        aria-label="Switch app"
        aria-expanded={open}
      >
        <Layers3 size={21} />
      </button>
    </div>
  );
};

export default FloatingAppSwitcher;
