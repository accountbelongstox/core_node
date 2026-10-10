/**
 * Global search box over every sent message and every unsent draft, whichever tab is shown:
 *  - every machine ever discovered (this machine and each other pycore) is asked live, in parallel;
 *  - MeshSync (the records every machine replicates to all Laravel servers) covers machines that are
 *    offline now;
 *  - drafts still only in this browser's cache are matched locally.
 * Each keystroke searches again (debounced, stale answers dropped); hits are merged newest first, one per
 * machine / terminal / message (a live answer replaces its replicated copy). Picking one hands it to the
 * page, which opens the terminal on that machine with the text in its composer.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPycoreProbe, pycoreNodeClient, type TerminalLogSearchHit } from '@/apps/pycore-manager/api';
import { listSearchNodes, type PcSearchNode } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import { PcOsIcon, pcOsKind } from '@/apps/pycore-manager/components/terminal/PcOsIcon';

const SEARCH_DEBOUNCE_MS = 200;
const NODE_SEARCH_TIMEOUT_MS = 5000;
const MESH_SEARCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 60;
const SNIPPET_BEFORE_CHARS = 24;
const SNIPPET_AFTER_CHARS = 72;
const PROBE_UP = 'up';
const LOCAL_DRAFT_ID = 'local';
/** Answer priority when the same message comes from several places: live node > browser cache > replica. */
const ORIGIN_RANK = { live: 3, local: 2, mesh: 1 } as const;

type PcSentSearchOrigin = keyof typeof ORIGIN_RANK;

/** A search hit with the machine it was written on. */
export interface PcSentSearchHit extends TerminalLogSearchHit {
  node: PcSearchNode;
  /** The machine is not reachable now: the hit comes from the MeshSync replica. */
  offline: boolean;
  origin: PcSentSearchOrigin;
}

interface PcTerminalSentSearchProps {
  /** Backend URL of the shown tab (null = this machine): owner of drafts found in the browser cache. */
  activeNodeUrl: string | null;
  /** Drafts mirrored in this browser, keyed by terminal number. */
  readLocalDrafts: () => Record<string, string>;
  formatDate: (value: string) => string;
  onPick: (hit: PcSentSearchHit) => void;
}

function snippet(content: string, query: string): { before: string; match: string; after: string } {
  const flat = content.replace(/\s+/g, ' ').trim();
  const index = flat.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return { before: '', match: '', after: flat.slice(0, SNIPPET_BEFORE_CHARS + SNIPPET_AFTER_CHARS) };
  const start = Math.max(0, index - SNIPPET_BEFORE_CHARS);
  const end = index + query.length;
  return {
    before: `${start > 0 ? '…' : ''}${flat.slice(start, index)}`,
    match: flat.slice(index, end),
    after: `${flat.slice(end, end + SNIPPET_AFTER_CHARS)}${end + SNIPPET_AFTER_CHARS < flat.length ? '…' : ''}`,
  };
}

function hitTime(hit: TerminalLogSearchHit): number {
  const time = Date.parse(hit.date);
  return Number.isNaN(time) ? 0 : time;
}

function hitKey(hit: PcSentSearchHit): string {
  const machine = hit.node.machineId || hit.node.url || '';
  const kind = hit.kind ?? 'sent';
  return `${machine}|${kind}|${hit.terminal_number}|${kind === 'draft' ? '' : hit.id}`;
}

/** One hit per message (the best source wins), newest first across machines, capped. */
function mergeHits(current: PcSentSearchHit[], incoming: PcSentSearchHit[]): PcSentSearchHit[] {
  const merged = new Map<string, PcSentSearchHit>();
  [...current, ...incoming].forEach((hit) => {
    const key = hitKey(hit);
    const kept = merged.get(key);
    if (!kept || ORIGIN_RANK[hit.origin] > ORIGIN_RANK[kept.origin]) merged.set(key, hit);
  });
  return [...merged.values()].sort((left, right) => hitTime(right) - hitTime(left)).slice(0, MAX_RESULTS);
}

function nodeOnline(node: PcSearchNode): boolean {
  return node.url === null || getPycoreProbe(node.url)?.state === PROBE_UP;
}

/** The discovered node of a replicated hit's machine, or a stand-in for a machine not discovered now. */
function meshNode(hit: TerminalLogSearchHit, nodes: PcSearchNode[]): PcSearchNode {
  const machine = hit.machine;
  const known = machine?.machine_id ? nodes.find((node) => node.machineId === machine.machine_id) : undefined;
  return known ?? {
    url: null,
    label: machine?.machine_name || machine?.machine_id || '',
    os: machine?.platform,
    machineId: machine?.machine_id,
  };
}

export const PcTerminalSentSearch: React.FC<PcTerminalSentSearchProps> = ({ activeNodeUrl, readLocalDrafts, formatDate, onPick }) => {
  const { t } = useTranslation('pc');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PcSentSearchHit[]>([]);
  const [pending, setPending] = useState(0);
  const [unreachable, setUnreachable] = useState<string[]>([]);
  const [nodeCount, setNodeCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const requestRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const readLocalDraftsRef = useRef(readLocalDrafts);
  readLocalDraftsRef.current = readLocalDrafts;

  useEffect(() => {
    const needle = query.trim();
    const request = ++requestRef.current;
    setHits([]);
    setUnreachable([]);
    setHighlighted(0);
    if (!needle) {
      setPending(0);
      return undefined;
    }
    const nodes = listSearchNodes(t('terminal.nodes.thisMachine'));
    const activeNode = nodes.find((node) => node.url === activeNodeUrl) ?? nodes[0];
    const lowerNeedle = needle.toLowerCase();
    const localHits: PcSentSearchHit[] = Object.entries(readLocalDraftsRef.current())
      .filter(([, text]) => text.toLowerCase().includes(lowerNeedle))
      .map(([terminalNumber, text]) => ({
        id: LOCAL_DRAFT_ID,
        terminal_number: Number(terminalNumber),
        title: '',
        date: '',
        status: 'draft',
        kind: 'draft',
        success: false,
        content: text,
        node: activeNode,
        offline: false,
        origin: 'local',
      }));
    const settle = (incoming: PcSentSearchHit[]) => {
      if (request === requestRef.current) setHits((current) => mergeHits(current, incoming));
    };
    const fail = (label: string) => {
      if (request === requestRef.current) setUnreachable((list) => [...list, label]);
    };
    const done = () => {
      if (request === requestRef.current) setPending((count) => Math.max(0, count - 1));
    };
    setNodeCount(nodes.length);
    setPending(nodes.length + 1);
    settle(localHits);
    const timer = window.setTimeout(() => {
      nodes.forEach((node) => {
        pycoreNodeClient(node.url).terminal.searchTerminalLogs(needle, NODE_SEARCH_TIMEOUT_MS)
          .then((result) => {
            if (!result?.success) {
              fail(node.label);
              return;
            }
            settle((result.results ?? []).map((hit) => ({ ...hit, node, offline: false, origin: 'live' })));
          })
          .catch(() => fail(node.label))
          .finally(done);
      });
      pycoreNodeClient(null).terminal.searchTerminalMesh(needle, MESH_SEARCH_TIMEOUT_MS)
        .then((result) => {
          if (!result?.success) return;
          settle((result.results ?? []).map((hit) => {
            const node = meshNode(hit, nodes);
            const discovered = nodes.includes(node);
            return { ...hit, node, offline: !discovered || !nodeOnline(node), origin: 'mesh' };
          }));
        })
        .catch(() => undefined)
        .finally(done);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeNodeUrl, query, t]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const pick = useCallback((hit: PcSentSearchHit) => {
    setOpen(false);
    onPick(hit);
  }, [onPick]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((value) => (value + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      pick(hits[Math.min(highlighted, hits.length - 1)]);
    }
  };

  const needle = query.trim();
  const searching = pending > 0;
  const allFailed = !searching && nodeCount > 0 && unreachable.length >= nodeCount;
  return (
    <div ref={rootRef} className="relative w-full min-w-[7rem] sm:max-w-xs">
      <label className="flex h-7 items-center gap-1.5 rounded-lg border border-slate-500/20 bg-white/60 px-2 text-xs text-slate-700 focus-within:border-indigo-500 dark:bg-slate-900/60 dark:text-slate-200">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('terminal.sentSearch.placeholder')}
          aria-label={t('terminal.sentSearch.placeholder')}
          title={t('terminal.sentSearch.scope')}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            title={t('terminal.sentSearch.clear')}
            aria-label={t('terminal.sentSearch.clear')}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </label>
      {open && needle && (
        <div
          role="listbox"
          aria-label={t('terminal.sentSearch.results')}
          className="absolute right-0 z-50 mt-1 max-h-[60vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-500/20 bg-white p-1 shadow-xl dark:bg-slate-900"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              {t(searching ? 'terminal.sentSearch.searching' : allFailed ? 'terminal.sentSearch.failed' : 'terminal.sentSearch.empty')}
            </p>
          ) : hits.map((hit, index) => {
            const part = snippet(hit.content, needle);
            return (
              <button
                key={`${hitKey(hit)}-${hit.origin}`}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(hit)}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-left ${
                  index === highlighted ? 'bg-indigo-500/10' : 'hover:bg-slate-500/10'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded px-1 ${
                      hit.offline ? 'bg-slate-500/10 text-slate-400' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                    }`}
                    title={hit.offline ? t('terminal.sentSearch.offlineHint') : undefined}
                  >
                    <PcOsIcon os={pcOsKind(hit.node.os)} />
                    <span className="max-w-[7rem] truncate">{hit.node.label}</span>
                    {hit.offline && <span>{t('terminal.sentSearch.offline')}</span>}
                  </span>
                  {hit.kind === 'draft' && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 font-semibold text-amber-700 dark:text-amber-300">
                      {t(hit.origin === 'local' ? 'terminal.sentSearch.localDraft' : 'terminal.sentSearch.draft')}
                    </span>
                  )}
                  <span className="truncate font-semibold text-indigo-600 dark:text-indigo-300">
                    {t('terminal.sentSearch.target', { number: hit.terminal_number, name: hit.title || t('terminal.untitled') })}
                  </span>
                  {hit.date && <span className="ml-auto shrink-0 tabular-nums text-slate-400">{formatDate(hit.date)}</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 break-all text-xs text-slate-700 dark:text-slate-200">
                  {part.before}
                  {part.match && <mark className="rounded bg-amber-300/60 px-0.5 text-inherit dark:bg-amber-400/40">{part.match}</mark>}
                  {part.after}
                </span>
              </button>
            );
          })}
          {(searching && hits.length > 0) && (
            <p className="px-3 py-1 text-[10px] text-slate-400">{t('terminal.sentSearch.searchingMore', { count: pending })}</p>
          )}
          {(!allFailed && unreachable.length > 0) && (
            <p className="px-3 py-1 text-[10px] text-slate-400" title={unreachable.join(', ')}>
              {t('terminal.sentSearch.unreachable', { count: unreachable.length, names: unreachable.join(', ') })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
