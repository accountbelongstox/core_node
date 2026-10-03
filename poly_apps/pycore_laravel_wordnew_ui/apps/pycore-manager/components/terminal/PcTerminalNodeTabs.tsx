/**
 * Node tabs of the terminal page: this machine (the selected pycore target)
 * first, then every other online pycore found on the LAN or the tailnet. Selecting one
 * re-mounts the same terminal view against that node's API.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Network, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getLanMachines,
  getPycoreProbe,
  getPycoreTarget,
  isLanMachinesAvailable,
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

const PROBE_UP = 'up';
const REPROBE_INTERVAL_MS = 30_000;

interface PcTerminalNodeTabsProps {
  /** Backend URL of the shown node; null is this machine. */
  activeUrl: string | null;
  onSelect: (url: string | null) => void;
}

function otherNodes(): PycoreEndpoint[] {
  const targetUrl = getPycoreTarget().url;
  return listPycoreEndpoints().filter((endpoint) => endpoint.kind !== 'relay' && endpoint.url !== targetUrl);
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
      void probePycoreEndpoints(list);
    });
    const stopProbes = subscribePycoreProbes(() => setProbeVersion((value) => value + 1));
    let firstDiscovery = true;
    const probeAll = () => {
      void Promise.all([refreshLanMachines(), refreshTailnetPeers()]).then(() => {
        const list = otherNodes();
        setNodes(list);
        void probePycoreEndpoints(list);
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

  const rescan = () => {
    setRescanning(true);
    void rescanLanMachines().finally(() => setRescanning(false));
  };
  const scanning = rescanning || getLanMachines().scanning;

  const online = nodes.filter((node) => node.url === activeUrl || getPycoreProbe(node.url)?.state === PROBE_UP);
  const thisLabel = listPycoreEndpoints().find((endpoint) => endpoint.url === target.url)?.label || t('terminal.nodes.thisMachine');

  const tab = (url: string | null, label: string, icon: React.ReactNode, title: string) => (
    <button
      key={url ?? 'primary'}
      type="button"
      role="tab"
      aria-selected={activeUrl === url}
      onClick={() => onSelect(url)}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        activeUrl === url
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
          : 'border border-slate-500/20 text-slate-600 hover:bg-slate-500/10 dark:text-slate-300'
      }`}
    >
      {icon}
      <span className="max-w-[10rem] truncate">{label}</span>
    </button>
  );

  return (
    <div role="tablist" aria-label={t('terminal.nodes.title')} className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {tab(null, thisLabel, <Monitor className="h-3.5 w-3.5 shrink-0" />, t('terminal.nodes.thisMachineHint', { url: target.url }))}
      {online.map((node) => tab(
        node.url,
        node.label,
        <Network className="h-3.5 w-3.5 shrink-0" />,
        t('terminal.nodes.otherHint', { url: node.url, os: node.os || '-' }),
      ))}
      {online.length === 0 && (
        <span className="whitespace-nowrap text-[10px] text-slate-400">{t('terminal.nodes.noOthers')}</span>
      )}
      {isLanMachinesAvailable() && (
        <button
          type="button"
          onClick={rescan}
          disabled={scanning}
          title={t('pycoreTarget.lanRescan')}
          aria-label={t('pycoreTarget.lanRescan')}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-slate-500/20 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-500/10 disabled:opacity-60 dark:text-slate-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${scanning ? 'animate-spin' : ''}`} />
          <span>{t('pycoreTarget.lanRescan')}</span>
        </button>
      )}
    </div>
  );
};
