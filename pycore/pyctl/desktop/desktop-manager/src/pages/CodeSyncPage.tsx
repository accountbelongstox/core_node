import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Code2, RefreshCcw, Server, MonitorSmartphone, Radar, Plus, X, Trash2,
  Pencil, Check, Users, Download, Wifi, WifiOff, PauseCircle, FileText, HardDrive,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useLive } from '../state/LiveContext';
import { pycoreApi } from '../api/pycore';
import type {
  CodeSyncRole, SelfStatus, PeerStatus, CodeSyncCandidate, CodeStats,
} from '../types';

/**
 * Code Sync — real-time peer-mesh control panel.
 *
 * This device picks a role (dev = source of truth that can push code; client =
 * always receives). Dev must explicitly enable "distributing" each startup before
 * code is pushed. The peer list shows reachability + live status, fed by the
 * backend `code_sync_update` WS tick (via useLive().codeSync) with a 5s poll
 * fallback against GET /code-sync/peers.
 */

const DEFAULT_PORT = 59000;

function relTime(ts: number | null, never: string): string {
  if (!ts) return never;
  // last_seen may be seconds or ms; normalise to ms.
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const diff = Date.now() - ms;
  if (diff < 0) return '0s';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatBytes(n: number | undefined | null): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

interface PeerDraft { name: string; host: string; port: string; role: CodeSyncRole; }

export default function CodeSyncPage() {
  const { settings, t, toast } = useApp();
  const { codeSync, wsConnected } = useLive();
  const dark = settings.theme === 'dark';

  const [self, setSelf] = useState<SelfStatus | null>(null);
  const [peers, setPeers] = useState<PeerStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  // discover / add / edit UI state
  const [discovering, setDiscovering] = useState(false);
  const [autoScanning, setAutoScanning] = useState(false);
  const [candidates, setCandidates] = useState<CodeSyncCandidate[]>([]);
  const autoDiscoveredRef = useRef(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<PeerDraft>({ name: '', host: '', port: String(DEFAULT_PORT), role: 'dev' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PeerDraft>({ name: '', host: '', port: String(DEFAULT_PORT), role: 'dev' });

  // --- load + poll fallback --------------------------------------------- #
  const loadPeers = useCallback(async () => {
    try {
      const r = await pycoreApi.getPeers();
      if (r?.success) {
        setSelf(r.self ?? null);
        setPeers(Array.isArray(r.peers) ? r.peers : []);
      }
    } catch { /* backend offline: keep last snapshot */ }
  }, []);

  useEffect(() => {
    loadPeers();
    pollRef.current = window.setInterval(loadPeers, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadPeers]);

  // Live WS tick wins over the poll: merge the snapshot as it arrives.
  useEffect(() => {
    if (!codeSync) return;
    if (codeSync.self) setSelf(codeSync.self);
    if (Array.isArray(codeSync.peers)) setPeers(codeSync.peers);
  }, [codeSync]);

  const role: CodeSyncRole = self?.role ?? 'dev';
  const distributing = !!self?.distributing;
  const skipUpdate = !!(self?.skip_update ?? self?.summary?.skip_update);
  const selfCode: CodeStats | undefined = self?.code ?? self?.summary?.code;

  // --- actions ----------------------------------------------------------- #
  const changeRole = async (next: CodeSyncRole) => {
    if (busy || next === role) return;
    setBusy(true);
    try {
      const r = await pycoreApi.setRole(next);
      if (r?.success) { toast(t.csRoleChanged, 'success'); await loadPeers(); }
      else toast(r?.error || t.csReqFailed, 'error');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  };

  const toggleDistribute = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await pycoreApi.setDistribute(enabled);
      if (r?.success) {
        setSelf((s) => (s ? { ...s, distributing: r.distributing } : s));
        if (r.message) toast(r.message, 'success');
        await loadPeers();
      } else toast(r?.error || t.csReqFailed, 'error');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  };

  const toggleSkipUpdate = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await pycoreApi.setSkipUpdate(enabled);
      if (r?.success) {
        setSelf((s) => (s ? { ...s, skip_update: r.skip_update } : s));
        if (r.message) toast(r.message, 'success');
        await loadPeers();
      } else toast(r?.error || t.csReqFailed, 'error');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  };

  const discover = async () => {
    setDiscovering(true);
    try {
      const r = await pycoreApi.discoverPeers();
      if (r?.success) setCandidates(Array.isArray(r.candidates) ? r.candidates : []);
      else toast(r?.error || t.csReqFailed, 'error');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
    finally { setDiscovering(false); }
  };

  // Delayed auto-discover: ~4s after mount, populate candidates ONCE.
  // Does not auto-add — candidates still require an explicit Add click.
  useEffect(() => {
    if (autoDiscoveredRef.current) return;
    autoDiscoveredRef.current = true;
    const timer = window.setTimeout(async () => {
      setAutoScanning(true);
      try {
        const r = await pycoreApi.discoverPeers();
        if (r?.success && Array.isArray(r.candidates)) setCandidates(r.candidates);
      } catch { /* best-effort scan; ignore */ }
      finally { setAutoScanning(false); }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const addPeer = async (peer: { name: string; host: string; port: number; role: CodeSyncRole }) => {
    if (!peer.host.trim()) { toast(t.csHost, 'error'); return; }
    try {
      const r = await pycoreApi.addPeer(peer);
      if (r?.success) {
        if (Array.isArray(r.peers)) setPeers(r.peers);
        if (r.self) setSelf(r.self);
        toast(t.csPeerAdded, 'success');
        setCandidates((c) => c.filter((x) => !(x.host === peer.host && x.port === peer.port)));
      } else toast(r?.error || t.csReqFailed, 'error');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
  };

  const confirmAdd = async () => {
    await addPeer({
      name: addDraft.name.trim() || addDraft.host.trim(),
      host: addDraft.host.trim(),
      port: Number(addDraft.port) || DEFAULT_PORT,
      role: addDraft.role,
    });
    setShowAdd(false);
    setAddDraft({ name: '', host: '', port: String(DEFAULT_PORT), role: 'dev' });
  };

  const removePeer = async (id: string) => {
    try {
      const r = await pycoreApi.removePeer(id);
      if (r?.success && Array.isArray(r.peers)) { setPeers(r.peers); if (r.self) setSelf(r.self); }
      else await loadPeers();
      toast(t.csPeerRemoved, 'success');
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
  };

  const startEdit = (p: PeerStatus) => {
    setEditId(p.id);
    setEditDraft({ name: p.name, host: p.host, port: String(p.port), role: p.role });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      const r = await pycoreApi.updatePeer({
        id: editId,
        name: editDraft.name.trim(),
        host: editDraft.host.trim(),
        port: Number(editDraft.port) || DEFAULT_PORT,
        role: editDraft.role,
      });
      if (r?.success && Array.isArray(r.peers)) { setPeers(r.peers); if (r.self) setSelf(r.self); }
      else await loadPeers();
      toast(t.csPeerUpdated, 'success');
      setEditId(null);
    } catch (e: any) { toast(`${t.csReqFailed}: ${e.message}`, 'error'); }
  };

  // --- styling helpers --------------------------------------------------- #
  const card = `rounded-3xl p-6 border backdrop-blur-xl transition-all ${
    dark ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-md'}`;
  const stat = `rounded-2xl p-4 border ${
    dark ? 'bg-white/5 border-white/5' : 'bg-slate-100/60 border-slate-300/35'}`;
  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';

  const roleBadge = (r: CodeSyncRole) => (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
      r === 'dev' ? 'bg-violet-500/15 text-violet-500' : 'bg-sky-500/15 text-sky-500'}`}>
      {r === 'dev' ? <Server className="w-3 h-3" /> : <MonitorSmartphone className="w-3 h-3" />}
      {r === 'dev' ? t.csDev : t.csClient2}
    </span>
  );

  const peerCode = (p: PeerStatus): CodeStats | undefined => {
    const s = p.status || undefined;
    return s?.code ?? s?.summary?.code;
  };
  const peerSkipping = (p: PeerStatus): boolean =>
    !!(p.status?.skip_update ?? p.status?.summary?.skip_update);

  // Compact code-stats line: "<files> files · <size> · updated <relTime>".
  const codeStatsLine = (code?: CodeStats) => {
    if (!code || (!code.files && !code.bytes && !code.last_modified)) {
      return <span className="text-slate-400">{t.csNoStats}</span>;
    }
    return (
      <span className="inline-flex items-center gap-2 text-slate-500">
        <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{code.files}</span>
        <span className="inline-flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(code.bytes)}</span>
        {code.last_modified > 0 && (
          <span>{t.csUpdated} {relTime(code.last_modified, t.csNever)}</span>
        )}
      </span>
    );
  };

  const skippingBadge = (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-500/15 text-amber-500">
      <PauseCircle className="w-3 h-3" /> {t.csSkipping}
    </span>
  );

  const peerStatusText = (p: PeerStatus): string => {
    const s: any = p.status || {};
    const sum = s.summary || s;
    const parts: string[] = [];
    if (p.role === 'dev') {
      if (typeof sum.distributing === 'boolean') parts.push(sum.distributing ? t.csDistributingOn : '—');
      if (typeof sum.clients === 'number') parts.push(`${sum.clients} ${t.csClients2}`);
    } else if (typeof sum.servers === 'number') {
      parts.push(`${sum.servers} ${t.csServers2}`);
    }
    return parts.join(' · ');
  };

  const ROLES: { id: CodeSyncRole; label: string; desc: string; icon: typeof Server }[] = [
    { id: 'dev', label: t.csDev, desc: t.csDevDesc, icon: Server },
    { id: 'client', label: t.csClient2, desc: t.csClientDesc2, icon: MonitorSmartphone },
  ];

  return (
    <div className="space-y-5">
      {/* This device */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Code2 className="w-5 h-5 text-sky-400" /> {t.codeSync}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.csThisDevice}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${wsConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
              {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </span>
            <button onClick={loadPeers} disabled={busy}
              className="px-3 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
              <RefreshCcw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> {t.csRefresh}
            </button>
          </div>
        </div>

        {/* role selector */}
        <span className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">{t.csRole}</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((m) => {
            const active = role === m.id;
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => changeRole(m.id)} disabled={busy}
                className={`flex flex-col items-center text-center gap-1 p-3 rounded-2xl border text-xs font-bold transition disabled:opacity-60 ${
                  active
                    ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}>
                <Icon className="w-5 h-5" /> {m.label}
                <span className="text-[10px] font-normal text-slate-400 leading-tight">{m.desc}</span>
              </button>
            );
          })}
        </div>

        {/* identity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">{t.csName}</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={self?.name}>{self?.name || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">{t.csHostname}</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={self?.hostname}>{self?.hostname || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">{t.csLanIp}</span>
            <div className="text-sm font-bold font-mono text-slate-700 dark:text-zinc-200 truncate">{self?.lan_ip || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">{t.csConfigVersion}</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200">{self?.config_version ?? '-'}</div>
          </div>
        </div>

        {/* role-specific control */}
        {role === 'dev' ? (
          <div className={`${stat} mt-4 flex items-start justify-between gap-4`}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-violet-500" /> {t.csStartDistributing}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{t.csDistributeHint}</p>
              {distributing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t.csDistributingOn}
                </span>
              )}
            </div>
            <button role="switch" aria-checked={distributing} disabled={busy}
              onClick={() => toggleDistribute(!distributing)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                distributing ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                distributing ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ) : (
          <div className={`${stat} mt-4 space-y-3`}>
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-sky-500" />
              {skipUpdate ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <PauseCircle className="w-3.5 h-3.5" /> {t.csSkipping}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t.csReceivingAlways}
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-4 pt-1 border-t border-slate-200/40 dark:border-white/5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 mt-2">
                  <PauseCircle className="w-4 h-4 text-amber-500" /> {t.csSkipUpdate}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{t.csSkipHint}</p>
              </div>
              <button role="switch" aria-checked={skipUpdate} disabled={busy}
                onClick={() => toggleSkipUpdate(!skipUpdate)}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 mt-2 ${
                  skipUpdate ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  skipUpdate ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* local code stats */}
        <div className={`${stat} mt-3 flex items-center gap-2 text-[11px]`}>
          <Code2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {codeStatsLine(selfCode)}
        </div>
      </div>

      {/* Peers */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" /> {t.csPeers}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={discover} disabled={discovering || autoScanning}
              className="px-3 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
              <Radar className={`w-3.5 h-3.5 ${discovering || autoScanning ? 'animate-spin' : ''}`} />
              {discovering ? t.csDiscovering : autoScanning ? t.csScanning : t.csDiscover}
            </button>
            <button onClick={() => setShowAdd(true)}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-lg shadow-sky-600/20 transition">
              <Plus className="w-4 h-4" /> {t.csAddPeer}
            </button>
          </div>
        </div>

        {/* discovered candidates */}
        {candidates.length > 0 && (
          <div className="mb-4">
            <span className="block text-[10px] tracking-wider text-slate-500 mb-1.5">{t.csCandidates}</span>
            <ul className="space-y-1.5">
              {candidates.map((c) => (
                <li key={c.id || `${c.host}:${c.port}`} className={`${stat} flex items-center gap-3`}>
                  {roleBadge(c.role)}
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{c.name || c.host}</span>
                  <span className="text-[11px] font-mono text-slate-500">{c.host}:{c.port}</span>
                  <button onClick={() => addPeer({ name: c.name || c.host, host: c.host, port: c.port, role: c.role })}
                    className="ml-auto px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 transition flex items-center gap-1">
                    <Download className="w-3 h-3" /> {t.csAdd}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* peer list */}
        {peers.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t.csNoPeers}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {peers.map((p) => (
              <li key={p.id} className={`${stat} ${editId === p.id ? '' : 'flex items-center gap-3'}`}>
                {editId === p.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input className={inputCls} placeholder={t.csName} value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
                      <input className={inputCls} placeholder={t.csHost} value={editDraft.host}
                        onChange={(e) => setEditDraft((d) => ({ ...d, host: e.target.value }))} />
                      <input className={inputCls} placeholder={t.csPort} value={editDraft.port}
                        onChange={(e) => setEditDraft((d) => ({ ...d, port: e.target.value }))} />
                      <select className={inputCls} value={editDraft.role}
                        onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value as CodeSyncRole }))}>
                        <option value="dev">{t.csDev}</option>
                        <option value="client">{t.csClient2}</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditId(null)}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                        {t.csCancel}
                      </button>
                      <button onClick={saveEdit}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1">
                        <Check className="w-3 h-3" /> {t.csSave}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${p.reachable ? 'bg-emerald-500' : 'bg-slate-400'}`}
                      title={p.reachable ? t.csReachable : t.csUnreachable} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{p.name || p.host}</span>
                        {roleBadge(p.role)}
                        {p.pending && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-500/15 text-amber-500">
                            {t.csPending}
                          </span>
                        )}
                        {peerSkipping(p) && skippingBadge}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">{p.host}:{p.port}</span>
                        {!p.reachable && <span>· {t.csLastSeen} {relTime(p.last_seen, t.csNever)}</span>}
                        {peerStatusText(p) && <span>· {peerStatusText(p)}</span>}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {codeStatsLine(peerCode(p))}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => startEdit(p)} title={t.csEdit}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-500/10 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removePeer(p.id)} title={t.csDelete}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* add peer dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}>
          <div className={`w-full max-w-md rounded-3xl p-6 border ${dark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-xl'}`}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-sky-500" /> {t.csAddPeer}</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">{t.csName}</label>
                <input className={`${inputCls} w-full`} value={addDraft.name} autoFocus
                  onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">{t.csHost}</label>
                  <input className={`${inputCls} w-full`} value={addDraft.host}
                    onChange={(e) => setAddDraft((d) => ({ ...d, host: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{t.csPort}</label>
                  <input className={`${inputCls} w-full`} value={addDraft.port}
                    onChange={(e) => setAddDraft((d) => ({ ...d, port: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">{t.csRole}</label>
                <select className={`${inputCls} w-full`} value={addDraft.role}
                  onChange={(e) => setAddDraft((d) => ({ ...d, role: e.target.value as CodeSyncRole }))}>
                  <option value="dev">{t.csDev}</option>
                  <option value="client">{t.csClient2}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                {t.csCancel}
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {t.csAdd}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
