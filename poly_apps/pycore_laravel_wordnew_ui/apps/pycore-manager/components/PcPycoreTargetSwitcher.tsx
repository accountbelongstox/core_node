/**
 * PcPycoreTargetSwitcher - header control to point the WHOLE pycore-manager at a
 * chosen pycore node and manage that client.
 *
 * Backend targets carry full URLs (PART_3 §3.3):
 *   - Current URL (origin, DEFAULT): direct to <page-host>:59000 (no proxy).
 *   - Local (this machine): same as Current URL - <page-host>:59000 direct.
 *   - Remote direct: http://<host>:59000 (LAN/Tailscale/public IP).
 *   - Remote relay (https entry): the server-side reverse proxy of the relay -
 *     requests ride the paired machine (PycoreRelayTransport) and the always-on
 *     roster link offers machine designation below.
 * Picking any target re-points the canonical pycore HTTP transport and reloads
 * the page so the entire UI manages the chosen node. Fixed quick-connect
 * presets plus Recent history and a custom add input are offered. This is
 * pure UI (state lives in pycoreTarget + LaravelRelayRoster +
 * PycoreRelayTransport).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Server, ChevronDown, Check, Plus, MonitorSmartphone, Globe, Link as LinkIcon, AlertTriangle, Radio, Users } from 'lucide-react';
import {
  getPycoreTarget, getPycoreTargetRecent, getPycoreTargetPresets, normalizePycoreHost, setPycoreTarget,
  localPycoreHost, isPycoreSecureContext, pnaBlockedReason,
  pycoreLocalConnectionHint, isPycoreRelayMode,
  relayDesignate, relayPairedMachineId, relayUndesignate,
} from '@/apps/pycore-manager/api';
import { laravelRelayRoster, type RelayRosterEntry } from '@/core/integrations/laravel';
import { relayCapabilityProviders } from '@/core/contracts/RelayCapabilities';
import { PYCORE_HTTP_PORT } from '@/apps/pycore-manager/api';

interface Props {
  variant?: 'header' | 'block';
}

export const PcPycoreTargetSwitcher: React.FC<Props> = ({ variant = 'header' }) => {
  const target = getPycoreTarget();           // read once; switching reloads anyway
  const mode = target.mode;
  const relayMode = isPycoreRelayMode();
  const remoteUrl = mode === 'remote' ? String(target.url || '') : '';
  const recent = getPycoreTargetRecent();
  const presets = getPycoreTargetPresets();
  const presetHosts = new Set(presets.map((p) => p.host));
  const recentShown = recent.filter((u) => !presetHosts.has(u));  // presets already cover these
  const localHost = localPycoreHost();        // page host - the "Local" target
  const connHint = pycoreLocalConnectionHint();
  const label = mode === 'remote'
    ? (remoteUrl.replace(/^https?:\/\//, '') || 'remote')
    : mode === 'local' ? 'Local'
      : 'Current URL';
  // Private Network Access: a non-secure-context page (HTTP on a public IP) is
  // blocked by the browser from reaching loopback/private pycore hosts directly.
  const secureCtx = isPycoreSecureContext();
  const pnaReason = pnaBlockedReason(mode === 'remote' ? null : localHost);

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [roster, setRoster] = useState<RelayRosterEntry[]>([]);
  const [designated, setDesignated] = useState<string | null>(relayPairedMachineId());
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Always-on roster link: registry truth + roster.update deltas (PART_3 §3.4).
  useEffect(() => {
    const stop = laravelRelayRoster.onChange((entries) => setRoster(entries));
    laravelRelayRoster.start();
    setRoster(laravelRelayRoster.list());
    return () => {
      stop();
      laravelRelayRoster.stop();
    };
  }, []);

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
  const goRemote = (u: string) => {
    const norm = normalizePycoreHost(u);
    if (norm) setPycoreTarget({ mode: 'remote', host: norm });         // persists + reloads
  };
  const goUrl = (u: string) => {
    const trimmed = u.trim();
    if (!trimmed) return;
    setPycoreTarget({ mode: 'remote', url: trimmed });                 // accepts http(s) entries
  };

  const designate = (machineId: string) => {
    void relayDesignate(machineId)
      .then((pair) => setDesignated(pair.machine_id))
      .catch(() => undefined); // roster stays; the pair badge explains the failure
  };
  const undesignate = () => {
    relayUndesignate();
    setDesignated(null);
  };

  const onlineMachines = roster.filter((entry) => entry.online);
  const providers = relayCapabilityProviders();

  const chipIcon = relayMode ? <Radio className="w-3.5 h-3.5" />
    : mode === 'remote' ? <Globe className="w-3.5 h-3.5" />
      : mode === 'local' ? <MonitorSmartphone className="w-3.5 h-3.5" />
        : <LinkIcon className="w-3.5 h-3.5" />;

  return (
    <div ref={rootRef} className={`relative ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Manage which pycore node this UI controls"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
          relayMode
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : mode === 'remote'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
        }`}
      >
        {chipIcon}
        <span className="max-w-[140px] truncate">pycore: {label}</span>
        {relayMode && (
          <span
            className={`px-1.5 rounded text-[9px] font-bold uppercase ${
              designated ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}
            title={designated ? `Paired with ${designated}` : 'Relay scheme selected - no machine designated'}
          >
            {designated ? 'paired' : 'unpaired'}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-3 text-sm max-h-[75vh] overflow-y-auto">
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
          {!pnaReason && !secureCtx && !relayMode && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/5 px-3 py-1.5 text-[10px] leading-relaxed text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Not a secure context (HTTP public IP): direct access to <b>127.0.0.1</b> or private IPs will be blocked by Private Network Access. Use the HTTPS relay backend (https:// entry below) or a localhost origin.</span>
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
                const active = mode === 'remote' && remoteUrl === `http://${p.host}:${PYCORE_HTTP_PORT}`;
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
                      <span className="text-[10px] font-mono text-slate-400 pl-6">{p.host}:{PYCORE_HTTP_PORT}</span>
                    </span>
                    {active && <Check className="w-4 h-4 text-amber-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent backends (URLs - direct entries and relay entries alike) */}
          {recentShown.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">Recent</div>
              {recentShown.map((u) => {
                const active = mode === 'remote' && remoteUrl === u;
                const isRelay = u.startsWith('https://');
                return (
                  <button
                    key={u}
                    onClick={() => goUrl(u)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      active
                        ? 'border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {isRelay
                        ? <Radio className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        : <Globe className="w-3.5 h-3.5 shrink-0" />}
                      {u}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Relay scheme section: roster + designation (PART_3 §3.4). */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">
              <Users className="w-3.5 h-3.5" /> Relay - machines ({onlineMachines.length} online)
            </div>
            {roster.length === 0 && (
              <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                No machines registered. A machine appears here once its pycore relay
                consumer registers (heartbeat every ~20 s).
              </p>
            )}
            {roster.map((entry) => {
              const isDesignated = designated === entry.machine_id;
              return (
                <div
                  key={entry.machine_id}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                    isDesignated
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-white/5'
                  }`}
                >
                  <span className="flex flex-col items-start text-slate-700 dark:text-slate-200 min-w-0">
                    <span className="flex items-center gap-2 text-xs truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${entry.online ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        title={entry.online ? 'online (heartbeat fresh)' : 'offline (heartbeat stale)'}
                      />
                      {entry.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 pl-4 truncate">
                      {entry.machine_id} · {entry.online ? 'online' : 'offline'}
                    </span>
                  </span>
                  {isDesignated ? (
                    <button
                      onClick={undesignate}
                      className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                      title="Drop the designation (unpair)"
                    >
                      PAIRED ✕
                    </button>
                  ) : (
                    <button
                      onClick={() => designate(entry.machine_id)}
                      disabled={!entry.online}
                      className={`text-[10px] font-mono font-bold shrink-0 ${
                        entry.online
                          ? 'text-indigo-600 dark:text-indigo-400 hover:underline'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                      title={entry.online ? 'Designate this machine (pair)' : 'Machine offline - the registry refuses pairing'}
                    >
                      DESIGNATE
                    </button>
                  )}
                </div>
              );
            })}
            {!relayMode && (
              <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                Designation engages with an <b>https</b> backend entry (relay scheme). The
                roster itself is always live - the registry is the truth, the stream is
                push-only.
              </p>
            )}
            {relayMode && !designated && onlineMachines.length > 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed px-1">
                Relay scheme selected but no machine designated - designate one above to
                enable forwarding.
              </p>
            )}
            {relayMode && designated && onlineMachines.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed px-1">
                Paired machine {designated} is offline - forwarding refuses (no
                store-and-forward across offline peers).
              </p>
            )}
          </div>

          {/* Declared capability providers (rendered, NOT wired - PART_3 §3.1). */}
          {providers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {providers.map((provider) => (
                <span
                  key={provider.id}
                  title={`${provider.providerClass} · provides: ${provider.provides.join(', ') || 'nothing declared'} ${provider.implemented ? '(implemented)' : '(declared, not implemented)'}`}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                    provider.implemented
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-300/60 dark:border-white/10 text-slate-400'
                  }`}
                >
                  {provider.id}
                </span>
              ))}
            </div>
          )}

          {/* Add / connect a backend */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block">
              Connect to backend URL (direct or relay)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') goUrl(url); }}
                placeholder="e.g. 100.101.149.39 · http://host:59000 · https://server"
                className="flex-1 py-2 px-3 text-xs font-mono rounded-lg outline-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => goUrl(url)}
                className="flex items-center gap-1 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Go
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Bare host / <b>http</b> entries connect directly on <b>:{PYCORE_HTTP_PORT}</b> (no proxy).
              An <b>https</b> entry is the relay scheme - the server-side reverse proxy that rides
              the designated machine. Current URL / Local = {localHost}:{PYCORE_HTTP_PORT}.
              Laravel is separate (<b>:9000</b>, header switcher). Switching reloads the page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcPycoreTargetSwitcher;
