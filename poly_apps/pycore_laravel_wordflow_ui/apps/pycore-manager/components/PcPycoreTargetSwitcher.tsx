/**
 * PcPycoreTargetSwitcher — header control to point the WHOLE pycore-manager at
 * another node's pycore (:59000) and manage that remote client by IP.
 *
 * Default is LOCAL (this machine). Picking a remote host re-points every pycore
 * transport (HTTP / RPC WS / SSE / health) via `pycoreTarget` and reloads the
 * page so the entire UI — every page, CodeSync included — manages the remote
 * node. A clear amber chip shows when a remote target is active.
 *
 * State + persistence live in core/api-libs/pycore/pycoreTarget; this is pure UI.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Server, ChevronDown, Check, Plus, MonitorSmartphone, Globe } from 'lucide-react';
import {
  getPycoreTarget, getPycoreTargetRecent, normalizePycoreHost, setPycoreTarget,
} from '../../../core/api-libs/pycore';

interface Props {
  variant?: 'header' | 'block';
}

export const PcPycoreTargetSwitcher: React.FC<Props> = ({ variant = 'header' }) => {
  const target = getPycoreTarget();           // read once; switching reloads anyway
  const recent = getPycoreTargetRecent();
  const isRemote = target.mode === 'remote';
  const label = isRemote ? (target.host as string) : 'Local';

  const [open, setOpen] = useState(false);
  const [host, setHost] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const goLocal = () => setPycoreTarget({ mode: 'local' });          // persists + reloads
  const goRemote = (h: string) => {
    const norm = normalizePycoreHost(h);
    if (norm) setPycoreTarget({ mode: 'remote', host: norm });       // persists + reloads
  };

  return (
    <div ref={rootRef} className={`relative ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Manage which pycore node this UI controls"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
          isRemote
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
        }`}
      >
        {isRemote ? <Globe className="w-3.5 h-3.5" /> : <MonitorSmartphone className="w-3.5 h-3.5" />}
        <span className="max-w-[140px] truncate">pycore: {label}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-slate-400">
            <Server className="w-3.5 h-3.5" /> Managed pycore node
          </div>

          {/* Local */}
          <button
            onClick={goLocal}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
              !isRemote ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <MonitorSmartphone className="w-4 h-4 text-indigo-500" /> Local (this machine)
            </span>
            {!isRemote && <Check className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Recent remotes */}
          {recent.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">Recent</div>
              {recent.map((h) => (
                <button
                  key={h}
                  onClick={() => goRemote(h)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    isRemote && target.host === h
                      ? 'border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate"><Globe className="w-3.5 h-3.5 shrink-0" /> {h}:59000</span>
                  {isRemote && target.host === h && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* Add / connect a remote */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block">
              Connect to remote IP (manage that client)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') goRemote(host); }}
                placeholder="e.g. 100.101.149.39"
                className="flex-1 py-2 px-3 text-xs font-mono rounded-lg outline-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => goRemote(host)}
                className="flex items-center gap-1 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Go
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Port is always 59000. Switching reloads the UI; it then controls that node's
              pycore (CodeSync, queues, AI, settings). The remote must allow this origin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcPycoreTargetSwitcher;
