/**
 * PcCodeSyncPage — pycore real-time peer-mesh control panel.
 *
 * Self-contained port of the pycore desktop-manager CodeSyncPage. This device
 * picks a role (dev = source of truth that can push code; client = always
 * receives). Dev distribution and client skip-update toggles persist in
 * `<cache>/pycore/codesync/runtime_prefs.json` (same backend path as the tray).
 * The peer list shows reachability + live status, fed by the backend
 * `code_sync_update` HTTP event with a low-frequency reconciliation poll
 * fallback against the code-sync peers HTTP (PycoreApi.getPeers).
 *
 * No dependency on the original app's AppContext / LiveContext / UI — local React
 * state, PycoreApi, HTTP helpers, lucide icons and Tailwind / `.pc-glass` only.
 * Degrades to an inline "pycore unreachable" banner and the last good snapshot
 * when the backend (:59000) is offline; no call ever crashes the page.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Code2, RefreshCcw, Server, MonitorSmartphone, Radar, Plus, X, Trash2,
  Pencil, Check, Users, Download, Wifi, WifiOff, PauseCircle, FileText, HardDrive,
  AlertTriangle, Filter, RotateCcw, ScrollText, GitBranch,
  Send, Inbox, CheckCircle2, XCircle, Layers, BarChart3, CircleSlash,
  FolderTree, Folder, File as FileIcon, ChevronRight, ChevronDown,
  GitCompare, FileMinus, FilePlus, FileWarning, Feather,
} from 'lucide-react';
import {
  pycoreApi, connectPycoreHttp, onHttpStatus, PYCORE_HTTP_DEFAULTS, PYCORE_PORT,
} from '@/apps/pycore-manager/api';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';
import type {
  CodeSyncRole, SelfStatus, PeerStatus, CodeSyncCandidate, CodeStats,
  SyncSettings, SyncLogEntry, FileTreeNode, PycoreFileTreeResponse, PeerFileTreeResponse,
} from '@/apps/pycore-manager/api';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { formatBytes } from '../../../core/utils/formatBytes';

const DEFAULT_PORT = PYCORE_PORT;

function relTime(ts: number | null, never = 'never'): string {
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

// Normalise a SyncLogEntry timestamp (seconds | ms | numeric-string | null) to ms.
function tsToMs(ts: number | string | null | undefined): number | null {
  const n = typeof ts === 'string' ? Number(ts) : ts;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

// Short wall-clock label (HH:MM) for chart axis endpoints.
function clockLabel(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

type ChartRangeId = '5m' | '30m' | '1h' | '24h';
const CHART_RANGES: { id: ChartRangeId; label: string; ms: number }[] = [
  { id: '5m', label: '5m', ms: 5 * 60 * 1000 },
  { id: '30m', label: '30m', ms: 30 * 60 * 1000 },
  { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
];

interface PeerDraft { name: string; host: string; port: string; role: CodeSyncRole; }

/** Small tag/chip editor for a string[] filter list (add via Enter or button). */
const ChipEditor: React.FC<{
  label: string; icon: React.ReactNode; items: string[];
  placeholder: string; onChange: (items: string[]) => void;
}> = ({ label, icon, items, placeholder, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) { setDraft(''); return; }
    onChange([...items, v]); setDraft('');
  };
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
        {icon} {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-mono bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {it}
            <button onClick={() => onChange(items.filter((x) => x !== it))}
              className="text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <input value={draft} placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            className="text-[11px] font-mono bg-white/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <button onClick={add}
            className="px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-500 text-[10px] font-bold hover:bg-indigo-500/25 transition">
            Add
          </button>
        </span>
      </div>
    </div>
  );
};

// Recursive rows for the synced file tree. Directories are click-to-toggle and
// remember their open state via the `expanded` map (persisted by the page); a
// collapsed dir hides its subtree, so the default (empty map) shows first level
// only. Files are leaves with a byte size.
const FileTreeRows: React.FC<{
  nodes: FileTreeNode[];
  depth: number;
  expanded: Record<string, boolean>;
  toggle: (path: string) => void;
}> = ({ nodes, depth, expanded, toggle }) => (
  <ul className="list-none m-0" style={{ paddingLeft: depth ? 14 : 0 }}>
    {nodes.map((n) => {
      if (n.type === 'dir') {
        const isOpen = !!expanded[n.path];
        return (
          <li key={n.path}>
            <div onClick={() => toggle(n.path)}
              className="flex items-center gap-1.5 py-0.5 cursor-pointer rounded hover:bg-slate-100/60 dark:hover:bg-white/5">
              {isOpen
                ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
              <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">{n.name}</span>
              <span className="text-[10px] text-slate-400 ml-1 shrink-0">{n.count ?? 0} · {formatBytes(n.size)}</span>
            </div>
            {isOpen && n.children && n.children.length > 0 && (
              <FileTreeRows nodes={n.children} depth={depth + 1} expanded={expanded} toggle={toggle} />
            )}
          </li>
        );
      }
      return (
        <li key={n.path}>
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="w-3 shrink-0" />
            <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{n.name}</span>
            <span className="text-[10px] text-slate-400 ml-1 shrink-0">{formatBytes(n.size)}</span>
          </div>
        </li>
      );
    })}
  </ul>
);

// Backend-owned peer-mesh snapshot kept alive across navigation/reload by the
// global task layer. All the discover/add/edit UI below stays page-local.
interface MeshSnapshot { self: SelfStatus | null; peers: PeerStatus[]; }

const PcCodeSyncPage: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [httpConnected, setHttpConnected] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // filter settings + sync log
  const [filters, setFilters] = useState<SyncSettings | null>(null);
  const [filtersOverridden, setFiltersOverridden] = useState(false);
  const [filtersDirty, setFiltersDirty] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  // Activity-chart time range (default 1h).
  const [chartRange, setChartRange] = useState<ChartRangeId>('1h');

  // Synced file structure: collapsible panel (hidden by default), with per-dir
  // expand state + the panel-open flag persisted to localStorage. Default shows
  // only the first level (empty expanded map = all dirs collapsed).
  const [tree, setTree] = useState<PycoreFileTreeResponse | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeOpen, setTreeOpen] = useState<boolean>(() => {
    return StorageManager.getRaw(StorageKeys.PYCORE_CODE_SYNC_TREE_OPEN) === '1';
  });
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>(() => {
    return StorageManager.get(StorageKeys.PYCORE_CODE_SYNC_TREE_EXPANDED, {});
  });

  // Dev-side drift viewer: a specific client's received tree + diff vs this dev.
  const [drift, setDrift] = useState<PeerFileTreeResponse | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftTab, setDriftTab] = useState<'missing' | 'changed' | 'extra' | 'tree'>('missing');
  const [driftTreeDirs, setDriftTreeDirs] = useState<Record<string, boolean>>({});

  // Continuous-poll view: snapshot + poll loop live in the global provider above
  // the router (survive navigation; reload re-polls the peers HTTP).
  const mesh = usePersistentTask<MeshSnapshot>('pycore.code-sync', {
    intervalMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs,
    poll: () => pycoreApi.getPeers()
      .then((r: any) => {
        setUnreachable(false);
        if (r?.success) return { self: r.self ?? null, peers: Array.isArray(r.peers) ? r.peers : [] };
        return null; // keep last snapshot when the call did not succeed
      })
      .catch(() => { setUnreachable(true); return null; /* offline: keep last snapshot */ }),
  });

  const self = mesh.data?.self ?? null;
  const peers = mesh.data?.peers ?? [];
  // Local setters that write through to the shared snapshot so action handlers
  // (role change, distribute, add/remove/edit peer) keep their original code.
  const setSelf = useCallback((next: SelfStatus | null | ((s: SelfStatus | null) => SelfStatus | null)) => {
    const cur = mesh.data ?? { self: null, peers: [] };
    const value = typeof next === 'function' ? (next as (s: SelfStatus | null) => SelfStatus | null)(cur.self) : next;
    mesh.set({ self: value, peers: cur.peers });
  }, [mesh]);
  const setPeers = useCallback((next: PeerStatus[]) => {
    const cur = mesh.data ?? { self: null, peers: [] };
    mesh.set({ self: cur.self, peers: next });
  }, [mesh]);

  // discover / add / edit UI state
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<CodeSyncCandidate[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<PeerDraft>({ name: '', host: '', port: String(DEFAULT_PORT), role: 'client' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PeerDraft>({ name: '', host: '', port: String(DEFAULT_PORT), role: 'client' });

  // Transient toast-style notice (self-clears). Replaces the original `toast`.
  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  }, []);

  // --- one-shot refresh used by action handlers ------------------------- #
  // (The continuous poll itself is owned by the global task layer below.)
  const loadPeers = useCallback(async () => {
    const r = await pycoreApi.getPeers().catch(() => { setUnreachable(true); return null as any; });
    if (r?.success) {
      mesh.set({ self: r.self ?? null, peers: Array.isArray(r.peers) ? r.peers : [] });
      setUnreachable(false);
    }
  }, [mesh]);

  // Start the continuous poll on first mount (idempotent if already running).
  useEffect(() => {
    if (!mesh.running) mesh.begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live HTTP event wins over the poll: merge the snapshot as it arrives.
  useEffect(() => {
    connectPycoreHttp();
    const offStatus = onHttpStatus(setHttpConnected);
    const offSync = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.codeSyncUpdate, (data: any) => {
      const cur = mesh.data ?? { self: null, peers: [] };
      mesh.set({
        self: data?.self ? data.self : cur.self,
        peers: Array.isArray(data?.peers) ? data.peers : cur.peers,
      });
    });
    return () => { offStatus(); offSync(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- filter settings + sync log: load on mount, poll logs every 5s ----- #
  const loadFilters = useCallback(async () => {
    try {
      const r = await pycoreApi.getSyncSettings();
      if (r?.success) {
        setFilters((prev) => (filtersDirty && prev ? prev : r.settings));
        setFiltersOverridden(!!r.overridden);
      }
    } catch { /* offline */ }
  }, [filtersDirty]);
  const loadLogs = useCallback(async () => {
    try {
      const r = await pycoreApi.getSyncLogs(100);
      if (r?.success && Array.isArray(r.logs)) setSyncLogs(r.logs);
    } catch { /* offline */ }
  }, []);
  useEffect(() => { loadFilters(); loadLogs(); }, [loadFilters, loadLogs]);
  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.codeSyncUpdate, PYCORE_EVENT_TOPICS.operationChanged],
    loadLogs,
    { fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs },
  );

  // --- synced file tree: lazy-load + poll only while the panel is open ----- #
  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const r = await pycoreApi.getFileTree();
      if (r?.success) setTree(r);
    } catch { /* offline: keep last tree */ }
    finally { setTreeLoading(false); }
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((m) => {
      const next = { ...m };
      if (next[path]) delete next[path]; else next[path] = true;
      StorageManager.set(StorageKeys.PYCORE_CODE_SYNC_TREE_EXPANDED, next);
      return next;
    });
  }, []);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_CODE_SYNC_TREE_OPEN, treeOpen ? '1' : '0');
    if (!treeOpen) return undefined;
    loadTree();
  }, [treeOpen, loadTree]);
  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.codeSyncUpdate, PYCORE_EVENT_TOPICS.operationChanged],
    loadTree,
    { fallbackMs: treeOpen ? 60_000 : 0, enabled: treeOpen },
  );

  // --- dev-side drift: fetch a client's received tree + diff -------------- #
  const openDrift = useCallback(async (peer: { id: string; name?: string; host: string; port: number }) => {
    setDriftLoading(true);
    setDriftTab('missing');
    setDriftTreeDirs({});
    const meta = { id: peer.id, name: peer.name || peer.host, host: peer.host, port: peer.port };
    setDrift({ success: false, peer: meta });
    try {
      const r = await pycoreApi.getPeerFileTree(peer.id);
      setDrift(r);
    } catch (e: any) {
      setDrift({ success: false, peer: meta, error: e?.message || 'request failed' });
    } finally { setDriftLoading(false); }
  }, []);

  const toggleDriftDir = useCallback((path: string) => {
    setDriftTreeDirs((m) => {
      const next = { ...m };
      if (next[path]) delete next[path]; else next[path] = true;
      return next;
    });
  }, []);

  const mutateList = (key: keyof SyncSettings, items: string[]) => {
    setFilters((f) => (f ? { ...f, [key]: items } : f));
    setFiltersDirty(true);
  };
  const saveFilters = async () => {
    if (!filters) return;
    setBusy(true);
    try {
      const r = await pycoreApi.setSyncSettings(filters);
      if (r?.success) { setFilters(r.settings); setFiltersDirty(false); setFiltersOverridden(true); flash('Filter settings saved'); }
      else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };
  const resetFilters = async () => {
    setBusy(true);
    try {
      const r = await pycoreApi.resetSyncSettings();
      if (r?.success) { setFilters(r.settings); setFiltersDirty(false); setFiltersOverridden(false); flash('Filters reset to defaults'); }
      else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const role: CodeSyncRole = self?.role ?? 'client';
  const distributing = !!self?.distributing;
  const skipUpdate = !!(self?.skip_update ?? self?.summary?.skip_update);
  const scanLan = !!filters?.scan_lan;
  // Start-time RECEIVE-ONLY light mode: read-only indicator (no toggle).
  const light = !!(self?.light ?? self?.summary?.light);
  const selfCode: CodeStats | undefined = self?.code ?? self?.summary?.code;

  // --- derived stats for the icon strip ---------------------------------- #
  const reachableCount = peers.filter((p) => p.reachable).length;
  const unreachableCount = peers.length - reachableCount;
  // Files queued = sum of per-channel counts where this device is actively pushing.
  const queuedFiles = Object.values(self?.sync_phase?.channels ?? {})
    .reduce((acc, ch) => acc + (ch?.phase === 'pushing' ? (ch.count || 0) : 0), 0);
  const syncedCount = syncLogs.filter((l) => l.action === 'sent' || l.action === 'received').length;
  const errorCount = syncLogs.filter((l) => l.action === 'error').length;

  // --- actions ----------------------------------------------------------- #
  const changeRole = async (next: CodeSyncRole) => {
    if (busy || next === role) return;
    setBusy(true);
    try {
      const r = await pycoreApi.setRole(next);
      if (r?.success) {
        mesh.set({
          self: r.self ?? null,
          peers: Array.isArray(r.peers) ? r.peers : [],
        });
        setCandidates([]);
        flash('Role changed');
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const toggleDistribute = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await pycoreApi.setDistribute(enabled);
      if (r?.success) {
        setSelf((s) => (s ? { ...s, distributing: r.distributing } : s));
        if (r.message) flash(r.message);
        await loadPeers();
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const toggleSkipUpdate = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await pycoreApi.setSkipUpdate(enabled);
      if (r?.success) {
        setSelf((s) => (s ? { ...s, skip_update: r.skip_update } : s));
        if (r.message) flash(r.message);
        await loadPeers();
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const discover = async () => {
    if (!scanLan) {
      flash('Enable LAN scanning first');
      return;
    }
    setDiscovering(true);
    try {
      const r = await pycoreApi.discoverPeers();
      if (r?.success) {
        setCandidates(Array.isArray(r.candidates) ? r.candidates : []);
        if (r.message && !(r.candidates?.length)) flash(r.message);
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setDiscovering(false); }
  };

  const toggleScanLan = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await pycoreApi.setSyncSettings({ scan_lan: enabled });
      if (r?.success) {
        setFilters((f) => (f ? { ...f, scan_lan: enabled } : f));
        if (!enabled) setCandidates([]);
        flash(enabled ? 'LAN scanning enabled' : 'LAN scanning disabled');
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const addPeer = async (peer: { name: string; host: string; port: number; role: CodeSyncRole }) => {
    if (!peer.host.trim()) { flash('Host is required'); return; }
    try {
      const r = await pycoreApi.addPeer(peer);
      if (r?.success) {
        if (Array.isArray(r.peers)) setPeers(r.peers);
        if (r.self) setSelf(r.self);
        flash('Peer added');
        setCandidates((c) => c.filter((x) => !(x.host === peer.host && x.port === peer.port)));
      } else flash(r?.error || 'Request failed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
  };

  const confirmAdd = async () => {
    await addPeer({
      name: addDraft.name.trim() || addDraft.host.trim(),
      host: addDraft.host.trim(),
      port: Number(addDraft.port) || DEFAULT_PORT,
      role: addDraft.role,
    });
    setShowAdd(false);
    setAddDraft({ name: '', host: '', port: String(DEFAULT_PORT), role: 'client' });
  };

  const removePeer = async (id: string) => {
    try {
      const r = await pycoreApi.removePeer(id);
      if (r?.success && Array.isArray(r.peers)) { setPeers(r.peers); if (r.self) setSelf(r.self); }
      else await loadPeers();
      flash('Peer removed');
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
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
      flash('Peer updated');
      setEditId(null);
    } catch (e: any) { flash(`Request failed: ${e.message}`); }
  };

  // --- styling helpers --------------------------------------------------- #
  const stat = 'rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5';
  const inputCls = 'text-xs bg-white/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  const roleBadge = (r: CodeSyncRole) => (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
      r === 'dev' ? 'bg-violet-500/15 text-violet-500' : 'bg-sky-500/15 text-sky-500'}`}>
      {r === 'dev' ? <Server className="w-3 h-3" /> : <MonitorSmartphone className="w-3 h-3" />}
      {r === 'dev' ? 'Dev' : 'Client'}
    </span>
  );

  const peerCode = (p: PeerStatus): CodeStats | undefined => {
    const s = p.status || undefined;
    return s?.code ?? s?.summary?.code;
  };
  const peerSkipping = (p: PeerStatus): boolean =>
    !!(p.status?.skip_update ?? p.status?.summary?.skip_update);
  // Peer's start-time RECEIVE-ONLY light mode (read-only indicator).
  const peerLight = (p: PeerStatus): boolean =>
    !!(p.status?.light ?? p.status?.summary?.light);

  // Live phase for a peer row: prefer this device's per-peer push channel,
  // else the peer's own aggregate sync_phase.
  const peerPhase = (p: PeerStatus): { phase: string; count: number } | undefined =>
    self?.sync_phase?.channels?.[p.id] ?? p.status?.sync_phase;

  // Compact code-stats line: "<files> files · <size> · updated <relTime>".
  const codeStatsLine = (code?: CodeStats) => {
    if (!code || (!code.files && !code.bytes && !code.last_modified)) {
      return <span className="text-slate-400">No code stats</span>;
    }
    return (
      <span className="inline-flex items-center gap-2 text-slate-500">
        <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{code.files}</span>
        <span className="inline-flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(code.bytes)}</span>
        {code.last_modified > 0 && (
          <span>updated {relTime(code.last_modified)}</span>
        )}
      </span>
    );
  };

  const skippingBadge = (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-500/15 text-amber-500">
      <PauseCircle className="w-3 h-3" /> Skipping
    </span>
  );

  // Read-only start-time light-mode badge (no toggle); shared self + per-peer.
  const lightBadge = (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-teal-500/15 text-teal-500"
      title="Light mode — receive-only (set at startup)">
      <Feather className="w-3 h-3" /> Light
    </span>
  );

  // Live HTTP event phase pill (idle hidden; active phases are animated).
  // "retrying" is a non-spinning amber alert (attempt #); others stay indigo+spin.
  const phaseBadge = (ph?: { phase: string; count: number }) => {
    if (!ph || ph.phase === 'idle' || !ph.phase) return null;
    const retrying = ph.phase === 'retrying';
    const cls = retrying ? 'bg-amber-500/15 text-amber-500' : 'bg-indigo-500/15 text-indigo-500';
    return (
      <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${cls}`}>
        {retrying
          ? <RotateCcw className="w-3 h-3" />
          : <Radar className="w-3 h-3 animate-spin" />}
        {ph.phase}{ph.count ? ` ${ph.count}` : ''}
      </span>
    );
  };

  // Render the size/diff column for a sync-log row: a signed coloured delta when
  // a non-zero `diff` is present, else free-text `details`, else the new size.
  const syncSizeCell = (l: SyncLogEntry): React.ReactNode => {
    if (typeof l.diff === 'number' && l.diff !== 0) {
      const up = l.diff > 0;
      return (
        <span className={`shrink-0 font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
          {up ? '+' : '-'}{formatBytes(Math.abs(l.diff))}
        </span>
      );
    }
    if (l.details) {
      let detail = l.details;
      if (l.action === 'connection') {
        const normalized = detail.toLowerCase();
        if (normalized.includes('10060') || normalized.includes('timed out')) detail = 'Connection timed out · retry scheduled';
        else if (normalized.includes('10061') || normalized.includes('refused')) detail = 'Connection refused · retry scheduled';
        else if (normalized.includes('10054') || normalized.includes('reset')) detail = 'Connection reset · retry scheduled';
      }
      return <span className="shrink-0 max-w-72 truncate text-slate-400" title={l.details}>{detail}</span>;
    }
    if (typeof l.size === 'number' && l.size > 0) {
      return <span className="shrink-0 text-slate-400">{formatBytes(l.size)}</span>;
    }
    return null;
  };

  // SyncLogEntry.timestamp may be a string/null; normalise to ms-number for relTime.
  const logTime = (ts: SyncLogEntry['timestamp']): string => {
    const n = typeof ts === 'string' ? Number(ts) : ts;
    return relTime(typeof n === 'number' && Number.isFinite(n) ? n : null, '');
  };

  // Action badge colour for a sync-log row.
  const logActionCls = (entry: SyncLogEntry): string => {
    switch (entry.action) {
      case 'error': return 'bg-rose-500/15 text-rose-500';
      case 'deleted': return 'bg-rose-500/15 text-rose-500';
      case 'skipped': return 'bg-amber-500/15 text-amber-500';
      case 'reconnect': return 'bg-violet-500/15 text-violet-500';
      case 'connection': return entry.reason?.toLowerCase().includes('connected')
        ? 'bg-emerald-500/15 text-emerald-500'
        : 'bg-amber-500/15 text-amber-500';
      case 'sent':
      case 'received': return 'bg-emerald-500/15 text-emerald-500';
      default: return 'bg-emerald-500/15 text-emerald-500';
    }
  };

  // How the peer is connected (outbound probe vs inbound heartbeat vs both).
  const viaBadge = (p: PeerStatus) => {
    if (!p.via) return null;
    const label = p.via === 'both' ? 'probe + heartbeat' : p.via === 'heartbeat' ? 'via heartbeat' : 'via probe';
    const cls = p.via === 'heartbeat' ? 'bg-sky-500/15 text-sky-500'
      : p.via === 'both' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-violet-500/15 text-violet-500';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${cls}`}>
        {p.via === 'heartbeat' ? <Radar className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
        {label}
      </span>
    );
  };

  const peerStatusText = (p: PeerStatus): string => {
    const s: any = p.status || {};
    const sum = s.summary || s;
    const parts: string[] = [];
    if (p.role === 'dev') {
      if (typeof sum.distributing === 'boolean') parts.push(sum.distributing ? 'Distributing' : '—');
      if (typeof sum.clients === 'number') parts.push(`${sum.clients} clients`);
    } else if (typeof sum.servers === 'number') {
      parts.push(`${sum.servers} servers`);
    }
    return parts.join(' · ');
  };

  // Small inline-SVG activity chart: buckets in-range sync logs into ~26 columns,
  // stacking success (sent/received/skipped, emerald) over error (rose).
  const renderActivityChart = (): React.ReactNode => {
    const rangeMs = (CHART_RANGES.find((r) => r.id === chartRange) ?? CHART_RANGES[2]).ms;
    const now = Date.now();
    const start = now - rangeMs;
    const BUCKETS = 26;
    const bw = rangeMs / BUCKETS;
    const ok = new Array(BUCKETS).fill(0);
    const err = new Array(BUCKETS).fill(0);
    let total = 0;
    for (const l of syncLogs) {
      const ms = tsToMs(l.timestamp);
      if (ms === null || ms < start || ms > now) continue;
      let idx = Math.floor((ms - start) / bw);
      if (idx < 0) idx = 0;
      if (idx >= BUCKETS) idx = BUCKETS - 1;
      if (l.action === 'error') err[idx] += 1;
      else if (l.action === 'sent' || l.action === 'received'
               || l.action === 'skipped' || l.action === 'deleted') ok[idx] += 1;
      else ok[idx] += 1;
      total += 1;
    }
    const max = Math.max(1, ...ok.map((v, i) => v + err[i]));

    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <BarChart3 className="w-3.5 h-3.5" /> Activity
          </span>
          <div className="flex items-center gap-1">
            {CHART_RANGES.map((r) => (
              <button key={r.id} onClick={() => setChartRange(r.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                  chartRange === r.id
                    ? 'bg-indigo-500/15 text-indigo-500'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {total === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            No activity in the last {chartRange}
          </div>
        ) : (
          <div>
            <svg viewBox="0 0 260 80" preserveAspectRatio="none" className="w-full h-24 overflow-visible">
              {ok.map((okV, i) => {
                const errV = err[i];
                const colW = 260 / BUCKETS;
                const x = i * colW;
                const gap = Math.min(1.2, colW * 0.18);
                const w = colW - gap;
                const okH = (okV / max) * 76;
                const errH = (errV / max) * 76;
                return (
                  <g key={i}>
                    {errV > 0 && (
                      <rect x={x} y={80 - errH} width={w} height={errH}
                        rx={0.8} className="fill-rose-500" />
                    )}
                    {okV > 0 && (
                      <rect x={x} y={80 - errH - okH} width={w} height={okH}
                        rx={0.8} className="fill-emerald-500" />
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span>{clockLabel(start)}</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> success</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500" /> error</span>
              </span>
              <span>now</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ROLES: { id: CodeSyncRole; label: string; desc: string; icon: typeof Server }[] = [
    { id: 'dev', label: 'Dev', desc: 'Source of truth — can push code to clients', icon: Server },
    { id: 'client', label: 'Client', desc: 'Always receives code from dev peers', icon: MonitorSmartphone },
  ];

  return (
    <div className="p-6 md:p-8 space-y-5">
      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            pycore unreachable — showing the last known peer-mesh snapshot. The backend (:59000) may be offline.
          </span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
          <span className="break-words">{notice}</span>
        </div>
      )}

      {/* This device */}
      <div className="pc-glass p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Code2 className="w-5 h-5 text-indigo-500" /> Code Sync
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">This device</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${httpConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
              {httpConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </span>
            <button onClick={loadPeers} disabled={busy}
              className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50 text-slate-700 dark:text-slate-200">
              <RefreshCcw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* role selector */}
        <span className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Role</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((m) => {
            const active = role === m.id;
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => changeRole(m.id)} disabled={busy}
                className={`flex flex-col items-center text-center gap-1 p-3 rounded-2xl border text-xs font-bold transition disabled:opacity-60 ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
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
            <span className="text-[10px] tracking-wider text-slate-500">Name</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={self?.name}>{self?.name || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">Hostname</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={self?.hostname}>{self?.hostname || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">LAN IP</span>
            <div className="text-sm font-bold font-mono text-slate-700 dark:text-zinc-200 truncate">{self?.lan_ip || '-'}</div>
          </div>
          <div className={stat}>
            <span className="text-[10px] tracking-wider text-slate-500">Config version</span>
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200">{self?.config_version ?? '-'}</div>
          </div>
        </div>

        {/* icon stat strip — compact derived stats (no extra API calls) */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-slate-600 dark:text-slate-300"
            title={`Role: ${role === 'dev' ? 'Dev' : 'Client'}`}>
            {role === 'dev' ? <Server className="w-3.5 h-3.5 text-violet-500" /> : <MonitorSmartphone className="w-3.5 h-3.5 text-sky-500" />}
            {role === 'dev' ? 'Dev' : 'Client'}
          </span>
          {role === 'dev' ? (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${distributing ? 'text-emerald-500' : 'text-slate-400'}`}
              title={`Distributing ${distributing ? 'on' : 'off'}`}>
              {distributing ? <Send className="w-3.5 h-3.5" /> : <CircleSlash className="w-3.5 h-3.5" />}
              {distributing ? 'Distributing' : 'Idle'}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${skipUpdate ? 'text-amber-500' : 'text-emerald-500'}`}
              title={`Skip update ${skipUpdate ? 'on' : 'off'}`}>
              {skipUpdate ? <PauseCircle className="w-3.5 h-3.5" /> : <Inbox className="w-3.5 h-3.5" />}
              {skipUpdate ? 'Skipping' : 'Receiving'}
            </span>
          )}
          {light && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-teal-500"
              title="Light mode — receive-only (set at startup, read-only)">
              <Feather className="w-3.5 h-3.5" /> Light
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-slate-600 dark:text-slate-300"
            title="Total peers">
            <Users className="w-3.5 h-3.5" /> {peers.length}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-emerald-500"
            title="Reachable peers">
            <Wifi className="w-3.5 h-3.5" /> {reachableCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-slate-400"
            title="Unreachable peers">
            <WifiOff className="w-3.5 h-3.5" /> {unreachableCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-indigo-500"
            title="Files queued for push">
            <Layers className="w-3.5 h-3.5" /> {queuedFiles}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 text-slate-600 dark:text-slate-300"
            title="Recent transfers (sent / received, last 100 log entries)">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {syncedCount}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/40 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${errorCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}
            title="Sync errors">
            <XCircle className="w-3.5 h-3.5" /> {errorCount}
          </span>
        </div>

        {/* role-specific control */}
        {role === 'dev' ? (
          <div className={`${stat} mt-4 flex items-start justify-between gap-4`}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-violet-500" /> Start distributing
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Must be enabled each startup before code is pushed to clients.</p>
              {distributing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Distributing
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
                  <PauseCircle className="w-3.5 h-3.5" /> Skipping
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Receiving always
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-4 pt-1 border-t border-slate-200/40 dark:border-white/5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 mt-2">
                  <PauseCircle className="w-4 h-4 text-amber-500" /> Skip update
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Temporarily ignore incoming code pushes from dev peers.</p>
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

        {/* watched root + live push/receive phase */}
        <div className={`${stat} mt-3 flex items-center gap-2 text-[11px]`}>
          <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 shrink-0">Watching</span>
          <span className="font-mono text-slate-600 dark:text-slate-300 truncate"
            title={(self?.watch_dirs && self.watch_dirs.length ? self.watch_dirs : [self?.watch_root]).join('\n')}>
            {self?.watch_dirs && self.watch_dirs.length ? self.watch_dirs.join(' · ') : (self?.watch_root || '-')}
          </span>
          {phaseBadge(self?.sync_phase)}
        </div>
      </div>

      {/* Peers */}
      <div className="pc-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" /> Peers
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={discover} disabled={discovering || !scanLan || role === 'client'}
              title={!scanLan ? 'Enable LAN scanning first' : role === 'client' ? 'Discovery is dev-only' : undefined}
              className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50 text-slate-700 dark:text-slate-200">
              <Radar className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
              {discovering ? 'Discovering…' : 'Discover'}
            </button>
            <button onClick={() => setShowAdd(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-lg shadow-indigo-600/20 transition">
              <Plus className="w-4 h-4" /> Add peer
            </button>
          </div>
        </div>

        <div className={`${stat} mt-3 flex items-center justify-between gap-4`}>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
              <Radar className="w-4 h-4 text-indigo-500" /> Scan LAN
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Off by default. Enable before using Discover to probe the local /24.</p>
          </div>
          <button role="switch" aria-checked={scanLan} disabled={busy || role === 'client'}
            onClick={() => toggleScanLan(!scanLan)}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
              scanLan ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              scanLan ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* discovered candidates */}
        {candidates.length > 0 && (
          <div className="mb-4">
            <span className="block text-[10px] tracking-wider text-slate-500 mb-1.5">Discovered candidates</span>
            <ul className="space-y-1.5">
              {candidates.map((c) => (
                <li key={c.id || `${c.host}:${c.port}`} className={`${stat} flex items-center gap-3`}>
                  {roleBadge(c.role)}
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{c.name || c.host}</span>
                  <span className="text-[11px] font-mono text-slate-500">{c.host}:{c.port}</span>
                  <button onClick={() => addPeer({ name: c.name || c.host, host: c.host, port: c.port, role: c.role })}
                    className="ml-auto px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 transition flex items-center gap-1">
                    <Download className="w-3 h-3" /> Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* peer list */}
        {peers.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            No peers yet — discover or add one above.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {peers.map((p) => (
              <li key={p.id} className={`${stat} ${editId === p.id ? '' : 'flex items-center gap-3'}`}>
                {editId === p.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input className={inputCls} placeholder="Name" value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
                      <input className={inputCls} placeholder="Host" value={editDraft.host}
                        onChange={(e) => setEditDraft((d) => ({ ...d, host: e.target.value }))} />
                      <input className={inputCls} placeholder="Port" value={editDraft.port}
                        onChange={(e) => setEditDraft((d) => ({ ...d, port: e.target.value }))} />
                      <select className={inputCls} value={editDraft.role}
                        onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value as CodeSyncRole }))}>
                        <option value="dev">Dev</option>
                        <option value="client">Client</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditId(null)}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                        Cancel
                      </button>
                      <button onClick={saveEdit}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1">
                        <Check className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${p.reachable ? 'bg-emerald-500' : 'bg-slate-400'}`}
                      title={p.reachable ? 'Reachable' : 'Unreachable'} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{p.name || p.host}</span>
                        {roleBadge(p.role)}
                        {viaBadge(p)}
                        {p.pending && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-500/15 text-amber-500">
                            Pending
                          </span>
                        )}
                        {peerSkipping(p) && skippingBadge}
                        {peerLight(p) && lightBadge}
                        {phaseBadge(peerPhase(p))}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">{p.host}:{p.port}</span>
                        {!p.reachable && <span>· last seen {relTime(p.last_seen)}</span>}
                        {p.reachable && p.via === 'heartbeat' && p.last_checkin && (
                          <span>· last contact {relTime(p.last_checkin)}</span>
                        )}
                        {peerStatusText(p) && <span>· {peerStatusText(p)}</span>}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {codeStatsLine(peerCode(p))}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {role === 'dev' && p.role === 'client' && (
                        <button onClick={() => openDrift(p)} title="View received tree + drift"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-500/10 transition">
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => startEdit(p)} title="Edit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removePeer(p.id)} title="Delete"
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

      {/* File structure (live tree of the synced set) */}
      <div className="pc-glass p-6">
        <div className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => setTreeOpen((o) => !o)}>
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <FolderTree className="w-4 h-4" /> File structure
            {tree && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-violet-500/15 text-violet-500">
                {tree.count} files · {formatBytes(tree.size)}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {treeOpen && (
              <button onClick={(e) => { e.stopPropagation(); loadTree(); }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition inline-flex items-center gap-1">
                <RefreshCcw className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            )}
            {treeOpen
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {treeOpen && (
          <div className="mt-3">
            {tree?.roots?.length ? (
              <div className="text-[11px] text-slate-500 mb-2 truncate" title={tree.roots.join('\n')}>
                <span className="font-bold">Roots:</span>{' '}
                <span className="font-mono">{tree.roots.join(' · ')}</span>
                {tree.truncated && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/15 text-amber-500">truncated</span>
                )}
              </div>
            ) : null}
            {!tree ? (
              <div className="text-xs text-slate-500 py-6 text-center">Loading…</div>
            ) : tree.children.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
                No files in the synced set
              </div>
            ) : (
              <div className="max-h-96 overflow-auto pr-1">
                <FileTreeRows nodes={tree.children} depth={0} expanded={expandedDirs} toggle={toggleDir} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter settings (code presets + per-machine .data override) */}
      {filters && (
        <div className="pc-glass p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter settings
              {filtersOverridden && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-sky-500/15 text-sky-500">.data</span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={resetFilters} disabled={busy}
                className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50 text-slate-700 dark:text-slate-200">
                <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
              </button>
              <button onClick={saveFilters} disabled={busy || !filtersDirty}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-lg shadow-indigo-600/20 transition disabled:opacity-40">
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            Folders / files matching these are never synced or counted. Edits save to this machine only (.data), not the code.
          </p>
          <div className="space-y-4">
            <ChipEditor label="Watched directories (empty = project root)" icon={<Server className="w-3.5 h-3.5" />}
              items={filters.watch_dirs} placeholder={self?.watch_root || 'project root'}
              onChange={(v) => mutateList('watch_dirs', v)} />
            <ChipEditor label="Excluded folders" icon={<Code2 className="w-3.5 h-3.5" />}
              items={filters.excluded_dirs} placeholder="node_modules"
              onChange={(v) => mutateList('excluded_dirs', v)} />
            <ChipEditor label="Excluded files" icon={<FileText className="w-3.5 h-3.5" />}
              items={filters.excluded_files} placeholder="secret.json"
              onChange={(v) => mutateList('excluded_files', v)} />
            <ChipEditor label="Excluded extensions" icon={<HardDrive className="w-3.5 h-3.5" />}
              items={filters.excluded_extensions} placeholder=".log"
              onChange={(v) => mutateList('excluded_extensions', v)} />
            <ChipEditor label="Excluded if path contains" icon={<Filter className="w-3.5 h-3.5" />}
              items={filters.excluded_path_substrings} placeholder="/cache/"
              onChange={(v) => mutateList('excluded_path_substrings', v)} />
          </div>
          <div className={`${stat} mt-4 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
              <GitBranch className="w-4 h-4 text-violet-500" /> Apply repo .gitignore
            </div>
            <button role="switch" aria-checked={filters.apply_gitignore} disabled={busy}
              onClick={() => { setFilters((f) => (f ? { ...f, apply_gitignore: !f.apply_gitignore } : f)); setFiltersDirty(true); }}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                filters.apply_gitignore ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                filters.apply_gitignore ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Sync log */}
      <div className="pc-glass p-6">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 mb-3">
          <ScrollText className="w-4 h-4" /> Sync log
        </h3>

        {/* time-range activity chart (built only from syncLogs timestamps) */}
        <div className="mb-4">
          {renderActivityChart()}
        </div>

        {syncLogs.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            No recent sync activity
          </div>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto font-mono text-[11px]">
            {syncLogs.slice().reverse().map((l, i) => {
              const t = logTime(l.timestamp);
              return (
                <li key={i} className="flex items-start gap-2 px-2 py-1 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/5">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${logActionCls(l)}`}>
                    {l.action || 'sync'}
                  </span>
                  <div className="min-w-0 flex-1">
                    {l.file_path && <span className="text-slate-600 dark:text-slate-300 break-all">{l.file_path}</span>}
                    {l.peer && (
                      <span className="text-slate-400 ml-1.5 break-all">
                        {l.direction === 'receive' || l.action === 'received' ? '←' : '→'} {l.peer}
                      </span>
                    )}
                    {l.reason && (
                      <span className="text-slate-400 ml-1.5 break-all">
                        {l.reason === 'HTTP SSE connection failed' ? 'SSE unavailable' : l.reason}
                      </span>
                    )}
                  </div>
                  {syncSizeCell(l)}
                  {t && <span className="shrink-0 text-slate-400 tabular-nums w-8 text-right">{t}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* client drift viewer dialog */}
      {drift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDrift(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <GitCompare className="w-4 h-4 text-violet-500" />
                {drift.peer.name} <span className="font-mono text-[11px] text-slate-400">{drift.peer.host}:{drift.peer.port}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => openDrift(drift.peer)}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition inline-flex items-center gap-1">
                  <RefreshCcw className={`w-3.5 h-3.5 ${driftLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button onClick={() => setDrift(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {driftLoading && !drift.drift ? (
              <div className="text-xs text-slate-500 py-10 text-center">Fetching the client's tree…</div>
            ) : !drift.success ? (
              <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">Could not reach this client: {drift.error || 'unknown error'}</span>
              </div>
            ) : (
              <>
                {/* drift summary chips */}
                <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-emerald-500/10 text-emerald-500" title="In sync (same content hash)">
                    <Check className="w-3.5 h-3.5" /> {drift.drift?.in_sync ?? 0} in sync
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-rose-500/10 text-rose-500" title="On the dev, not yet on this client">
                    <FileMinus className="w-3.5 h-3.5" /> {drift.drift?.missing.length ?? 0} missing
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-amber-500/10 text-amber-500" title="Present on both, different content">
                    <FileWarning className="w-3.5 h-3.5" /> {drift.drift?.changed.length ?? 0} changed
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-sky-500/10 text-sky-500" title="On the client, not on the dev">
                    <FilePlus className="w-3.5 h-3.5" /> {drift.drift?.extra.length ?? 0} extra
                  </span>
                  <span className="text-slate-400 ml-auto">dev {drift.drift?.dev_count ?? 0} · client {drift.drift?.client_count ?? 0}</span>
                </div>

                {/* tabs */}
                <div className="flex items-center gap-1 mb-2 border-b border-slate-200/60 dark:border-white/5">
                  {([['missing', 'Missing'], ['changed', 'Changed'], ['extra', 'Extra'], ['tree', 'Client tree']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setDriftTab(id)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-t-lg transition ${
                        driftTab === id ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="overflow-auto flex-1 min-h-0">
                  {driftTab === 'tree' ? (
                    drift.tree && drift.tree.children.length > 0 ? (
                      <FileTreeRows nodes={drift.tree.children} depth={0} expanded={driftTreeDirs} toggle={toggleDriftDir} />
                    ) : (
                      <div className="text-xs text-slate-500 py-8 text-center">The client reports no synced files.</div>
                    )
                  ) : (
                    (() => {
                      const rows = driftTab === 'missing' ? (drift.drift?.missing ?? [])
                        : driftTab === 'changed' ? (drift.drift?.changed ?? [])
                          : (drift.drift?.extra ?? []);
                      if (rows.length === 0) {
                        return <div className="text-xs text-slate-500 py-8 text-center">Nothing here — this set is clean.</div>;
                      }
                      return (
                        <ul className="space-y-0.5 font-mono text-[11px]">
                          {rows.map((r: any) => (
                            <li key={r.path} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100/60 dark:hover:bg-white/5">
                              {driftTab === 'missing' && <FileMinus className="w-3 h-3 text-rose-500 shrink-0" />}
                              {driftTab === 'changed' && <FileWarning className="w-3 h-3 text-amber-500 shrink-0" />}
                              {driftTab === 'extra' && <FilePlus className="w-3 h-3 text-sky-500 shrink-0" />}
                              <span className="text-slate-700 dark:text-slate-300 break-all flex-1 min-w-0">{r.path}</span>
                              <span className="text-slate-400 shrink-0">
                                {driftTab === 'changed'
                                  ? `${formatBytes(r.size_dev)} → ${formatBytes(r.size_client)}`
                                  : formatBytes(r.size)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* add peer dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><Plus className="w-4 h-4 text-indigo-500" /> Add peer</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Name</label>
                <input className={`${inputCls} w-full`} value={addDraft.name} autoFocus
                  onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">Host</label>
                  <input className={`${inputCls} w-full`} value={addDraft.host}
                    onChange={(e) => setAddDraft((d) => ({ ...d, host: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Port</label>
                  <input className={`${inputCls} w-full`} value={addDraft.port}
                    onChange={(e) => setAddDraft((d) => ({ ...d, port: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Role</label>
                <select className={`${inputCls} w-full`} value={addDraft.role}
                  onChange={(e) => setAddDraft((d) => ({ ...d, role: e.target.value as CodeSyncRole }))}>
                  <option value="dev">Dev</option>
                  <option value="client">Client</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">
                Cancel
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcCodeSyncPage;
