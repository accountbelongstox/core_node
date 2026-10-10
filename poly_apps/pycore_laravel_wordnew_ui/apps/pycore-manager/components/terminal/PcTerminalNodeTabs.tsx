/**
 * Node tabs of the terminal page: this machine (the selected pycore target)
 * first, then every other online pycore found on the LAN or the tailnet. Selecting one
 * re-mounts the same terminal view against that node's API.
 */
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getLanMachines,
  getPycoreProbe,
  getPycoreSelectionUrls,
  getPycoreTarget,
  isLanMachinesAvailable,
  isSamePycoreMachine,
  listPycoreEndpoints,
  probePycoreEndpoints,
  refreshLanMachines,
  refreshTailnetPeers,
  rescanLanMachines,
  subscribeLanMachines,
  subscribePycoreProbes,
  subscribeTailnetPeers,
  type PycoreEndpoint,
} from '@/apps/pycore-manager/api';
import { PcOsIcon, pcOsKind } from '@/apps/pycore-manager/components/terminal/PcOsIcon';

const PROBE_UP = 'up';
const REPROBE_INTERVAL_MS = 30_000;
/** An unreachable node is asked again only this often, not on every 30s round. */
const DOWN_REPROBE_MS = 300_000;

interface PcTerminalNodeTabsProps {
  /** Backend URL of the shown node; null is this machine. */
  activeUrl: string | null;
  onSelect: (url: string | null) => void;
}

function dueForProbe<T extends { url: string }>(nodes: T[]): T[] {
  const now = Date.now();
  return nodes.filter((node) => {
    const probe = getPycoreProbe(node.url);
    return !probe || probe.state === PROBE_UP || now - probe.checkedAt >= DOWN_REPROBE_MS;
  });
}

function otherNodes(): PycoreEndpoint[] {
  const selectionUrls = new Set(getPycoreSelectionUrls());
  return listPycoreEndpoints().filter((endpoint) => endpoint.kind !== 'relay' && !selectionUrls.has(endpoint.url));
}

/** This machine's URLs (the selection, its LAN route) plus the active target, probed so their identity is known. */
function selectionTargets() {
  const target = getPycoreTarget();
  const urls = getPycoreSelectionUrls();
  const known = new Map(listPycoreEndpoints().map((endpoint) => [endpoint.url, endpoint]));
  return [target, ...urls.filter((url) => url !== target.url).flatMap((url) => known.get(url) ?? [])];
}

/** The platform this machine reports through any of its URLs. */
function selectionPlatform(): string {
  return getPycoreSelectionUrls().map((url) => getPycoreProbe(url)?.platform || '').find(Boolean) || '';
}

export interface PcSearchNode {
  /** Backend URL; null is this machine (the selected pycore target). */
  url: string | null;
  label: string;
  os?: string;
  /** pycore machine id (from the node's /api/status probe), when known. */
  machineId?: string;
}

/** Every machine ever discovered (online or not, one entry per machine id), this machine first: the sent-message search asks them all. */
export function listSearchNodes(thisMachineLabel: string): PcSearchNode[] {
  const target = getPycoreTarget();
  const thisLabel = listPycoreEndpoints().find((endpoint) => endpoint.url === target.url)?.label || thisMachineLabel;
  return [
    {
      url: null,
      label: thisLabel,
      os: selectionPlatform() || undefined,
      machineId: getPycoreSelectionUrls().map((url) => getPycoreProbe(url)?.machineId || '').find(Boolean) || undefined,
    },
    ...uniqueMachines(otherNodes(), null).map((node) => ({
      url: node.url,
      label: node.label,
      os: getPycoreProbe(node.url)?.platform || node.os,
      machineId: getPycoreProbe(node.url)?.machineId,
    })),
  ];
}

/**
 * One tab per machine: a node that reaches this machine (127.0.0.1 vs its LAN/tailnet URL), the shown
 * node's machine or an earlier tab's machine is dropped; the shown node always stays.
 */
function uniqueMachines(nodes: PycoreEndpoint[], activeUrl: string | null): PycoreEndpoint[] {
  const kept: string[] = [];
  const claimed = [...getPycoreSelectionUrls(), ...(activeUrl ? [activeUrl] : [])];
  return nodes.filter((node) => {
    if (node.url !== activeUrl && [...claimed, ...kept].some((url) => isSamePycoreMachine(url, node.url))) return false;
    kept.push(node.url);
    return true;
  });
}

export const PcTerminalNodeTabs: React.FC<PcTerminalNodeTabsProps> = ({ activeUrl, onSelect }) => {
  const { t } = useTranslation('pc');
  const target = getPycoreTarget();
  const [nodes, setNodes] = useState<PycoreEndpoint[]>(otherNodes);
  const [, setProbeVersion] = useState(0);
  const [rescanning, setRescanning] = useState(false);
  const activeUrlRef = useRef(activeUrl);
  activeUrlRef.current = activeUrl;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const stopPeers = subscribeTailnetPeers(() => setNodes(otherNodes()));
    const stopLan = subscribeLanMachines(() => {
      const list = otherNodes();
      setNodes(list);
      void probePycoreEndpoints(dueForProbe([...selectionTargets(), ...list]));
    });
    const stopProbes = subscribePycoreProbes(() => setProbeVersion((value) => value + 1));
    let firstDiscovery = true;
    const probeAll = () => {
      void Promise.all([refreshLanMachines(), refreshTailnetPeers()]).then(() => {
        const list = otherNodes();
        setNodes(list);
        // This machine is probed too: its /api/status reports the OS its tab shows.
        void probePycoreEndpoints(dueForProbe([...selectionTargets(), ...list]));
        // A node restored from the last session that discovery no longer knows falls back to this machine, once.
        const restoredUrl = activeUrlRef.current;
        if (firstDiscovery && restoredUrl !== null && !list.some((node) => node.url === restoredUrl)) {
          onSelectRef.current(null);
        }
        firstDiscovery = false;
      });
    };
    probeAll();
    const timer = window.setInterval(probeAll, REPROBE_INTERVAL_MS);
    return () => {
      stopPeers();
      stopLan();
      stopProbes();
      window.clearInterval(timer);
    };
  }, []);

  // A shown node that turns out to be this machine under another URL folds back into tab 1.
  const activeIsSelection = activeUrl !== null && getPycoreSelectionUrls().some((url) => isSamePycoreMachine(url, activeUrl));
  useEffect(() => {
    if (activeIsSelection) onSelectRef.current(null);
  }, [activeIsSelection]);

  const rescan = () => {
    setRescanning(true);
    void rescanLanMachines().finally(() => setRescanning(false));
  };
  const scanning = rescanning || getLanMachines().scanning;

  const online = uniqueMachines(
    nodes.filter((node) => node.url === activeUrl || getPycoreProbe(node.url)?.state === PROBE_UP),
    activeUrl,
  );
  const thisLabel = listPycoreEndpoints().find((endpoint) => endpoint.url === target.url)?.label || t('terminal.nodes.thisMachine');

  const tab = (url: string | null, index: number, os: string | undefined, title: string) => (
    <button
      key={url ?? 'primary'}
      type="button"
      role="tab"
      aria-selected={activeUrl === url}
      aria-label={title}
      onClick={() => onSelect(url)}
      title={title}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold tabular-nums transition ${
        activeUrl === url
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
          : 'border border-slate-500/20 text-slate-600 hover:bg-slate-500/10 dark:text-slate-300'
      }`}
    >
      <PcOsIcon os={pcOsKind((url ? getPycoreProbe(url)?.platform : selectionPlatform()) || os)} />
      <span>{index}</span>
    </button>
  );

  return (
    <div role="tablist" aria-label={t('terminal.nodes.title')} className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tab(null, 1, undefined, `${thisLabel} · ${t('terminal.nodes.thisMachineHint', { url: target.url })}`)}
      {online.map((node, index) => tab(
        node.url,
        index + 2,
        node.os,
        `${node.label} · ${t('terminal.nodes.otherHint', { url: node.url, os: node.os || '-' })}`,
      ))}
      {isLanMachinesAvailable() && (
        <button
          type="button"
          onClick={rescan}
          disabled={scanning}
          title={online.length === 0 ? `${t('pycoreTarget.lanRescan')} · ${t('terminal.nodes.noOthers')}` : t('pycoreTarget.lanRescan')}
          aria-label={t('pycoreTarget.lanRescan')}
          className="inline-flex shrink-0 items-center rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-500/10 disabled:opacity-60 dark:text-slate-400"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};
