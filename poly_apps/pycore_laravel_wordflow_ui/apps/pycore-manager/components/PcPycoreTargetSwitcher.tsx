/**
 * PcPycoreTargetSwitcher - header control to point the WHOLE pycore-manager at a
 * chosen pycore node and manage that client.
 *
 * Three target modes (state + persistence in core/api-libs/pycore/pycoreTarget):
 *   - Current URL (origin, DEFAULT): direct to <page-host>:59000 (no proxy).
 *   - Local (this machine): same as Current URL - <page-host>:59000 direct.
 *   - Remote: an explicit host/IP on :59000 (e.g. 127.0.0.1 when the browser is
 *     on the pycore machine, or the machine's LAN/Tailscale/public IP).
 * Picking any target re-points the canonical RPC v2 WebSocket and health view and
 * reloads the page so the entire UI manages the chosen node. Fixed quick-connect
 * presets (Localhost / Public IP / Tailscale LAN) plus Recent history and a custom
 * add input are offered. This is pure UI.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Server, ChevronDown, Check, Plus, MonitorSmartphone, Globe, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import {
  getPycoreTarget, getPycoreTargetRecent, getPycoreTargetPresets, normalizePycoreHost, setPycoreTarget,
  localPycoreHost, isPycoreSecureContext, pnaBlockedReason,
  pycoreLocalConnectionHint,
} from '../../../core/api-libs/pycore/pycoreTarget';

interface Props {
  variant?: 'header' | 'block';
}

export const PcPycoreTargetSwitcher: React.FC<Props> = ({ variant = 'header' }) => {
  const target = getPycoreTarget();           // read once; switching reloads anyway
  const mode = target.mode;
  const recent = getPycoreTargetRecent();
  const presets = getPycoreTargetPresets();
  const presetHosts = new Set(presets.map((p) => p.host));
  const recentShown = recent.filter((h) => !presetHosts.has(h));  // presets already cover these
  const localHost = localPycoreHost();        // page host - the "Local" target
  const connHint = pycoreLocalConnectionHint();
  const label = mode === 'remote' ? (target.host as string)
    : mode === 'local' ? 'Local'
      : 'Current URL';
  // Private Network Access: a non-secure-context page (HTTP on a public IP) is
  // blocked by the browser from reaching loopback/private pycore hosts directly.
  const secureCtx = isPycoreSecureContext();
  const activeHost = mode === 'remote' ? (target.host as string) : localHost;
  const pnaReason = pnaBlockedReason(activeHost);

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

  const goOrigin = () => setPycoreTarget({ mode: 'origin' });          // persists + reloads
  const goLocal = () => setPycoreTarget({ mode: 'local' });            // persists + reloads
  const goRemote = (h: string) => {
    const norm = normalizePycoreHost(h);
    if (norm) setPycoreTarget({ mode: 'remote', host: norm });         // persists + reloads
  };

  const chipIcon = mode === 'remote' ? <Globe className="w-3.5 h-3.5" />
    : mode === 'local' ? <MonitorSmartphone className="w-3.5 h-3.5" />
      : <LinkIcon className="w-3.5 h-3.5" />;

  return (
    <div ref={rootRef} className={`relative ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Manage which pycore node this UI controls"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
          mode === 'remote'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
        }`}
      >
        {chipIcon}
        <span className="max-w-[140px] truncate">pycore: {label}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-slate-400">
            <Server className="w-3.5 h-3.5" /> Managed pycore node
          </div>

          {/* PNA warning: non-secure-context page cannot directly reach a
              loopback/private pycore host. Tell the user the three workarounds. */}
          {pnaReason && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{pnaReason}</span>
            </div>
          )}
          {!pnaReason && !secureCtx && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/5 px-3 py-1.5 text-[10px] leading-relaxed text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Not a secure context (HTTP public IP): direct access to <b>127.0.0.1</b> or private IPs will be blocked by Private Network Access. Current target ({activeHost}:59000) is reachable because it is in the same address space.</span>
            </div>
          )}

          {/* Current URL (origin, default) - direct to <page-host>:59000 */}
          <button
            onClick={goOrigin}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
              mode === 'origin' ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex flex-col items-start text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4 text-indigo-500" /> Current URL</span>
              <span className="text-[10px] font-mono text-slate-400 pl-6">{connHint}</span>
            </span>
            {mode === 'origin' && <Check className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Local (this machine) - page host on :59000 */}
          <button
            onClick={goLocal}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
              mode === 'local' ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex flex-col items-start text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-2"><MonitorSmartphone className="w-4 h-4 text-indigo-500" /> Local (this machine)</span>
              <span className="text-[10px] font-mono text-slate-400 pl-6">{connHint}</span>
            </span>
            {mode === 'local' && <Check className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Quick-connect presets (fixed hosts on :59000) */}
          {presets.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">Quick connect</div>
              {presets.map((p) => {
                const active = mode === 'remote' && target.host === p.host;
                return (
                  <button
                    key={p.host}
                    onClick={() => goRemote(p.host)}
                    title={p.hint ? `${p.label} (${p.hint})` : p.label}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                      active
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="flex flex-col items-start text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-2 text-xs"><Globe className="w-4 h-4 text-sky-500" /> {p.label}</span>
                      <span className="text-[10px] font-mono text-slate-400 pl-6">{p.host}:59000</span>
                    </span>
                    {active && <Check className="w-4 h-4 text-amber-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent remotes */}
          {recentShown.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">Recent</div>
              {recentShown.map((h) => (
                <button
                  key={h}
                  onClick={() => goRemote(h)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    mode === 'remote' && target.host === h
                      ? 'border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate"><Globe className="w-3.5 h-3.5 shrink-0" /> {h}:59000</span>
                  {mode === 'remote' && target.host === h && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
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
              All modes connect directly to <b>host:59000</b> (no proxy).
              Current URL / Local = {localHost}:59000; Remote = any host:59000.
              Laravel is separate (<b>:9000</b>, header switcher). Switching reloads the page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcPycoreTargetSwitcher;
