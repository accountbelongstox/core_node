/**
 * Search box over every message sent to the terminals of every machine ever discovered (this machine
 * and each other pycore, whichever tab is shown): each keystroke asks all of them in parallel
 * (debounced, stale answers dropped), merges the newest matches with their machine, terminal and date,
 * and reports machines that did not answer. Picking one hands it to the page, which switches to that
 * machine and opens the terminal with the message in its composer.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreNodeClient, type TerminalLogSearchHit } from '@/apps/pycore-manager/api';
import { listSearchNodes, type PcSearchNode } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import { PcOsIcon, pcOsKind } from '@/apps/pycore-manager/components/terminal/PcOsIcon';

const SEARCH_DEBOUNCE_MS = 200;
const NODE_SEARCH_TIMEOUT_MS = 5000;
const MAX_RESULTS = 60;
const SNIPPET_BEFORE_CHARS = 24;
const SNIPPET_AFTER_CHARS = 72;

/** A search hit with the machine it was sent on. */
export interface PcSentSearchHit extends TerminalLogSearchHit {
  node: PcSearchNode;
}

interface PcTerminalSentSearchProps {
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

/** Newest first across machines, capped. */
function mergeHits(current: PcSentSearchHit[], incoming: PcSentSearchHit[]): PcSentSearchHit[] {
  return [...current, ...incoming].sort((left, right) => hitTime(right) - hitTime(left)).slice(0, MAX_RESULTS);
}

export const PcTerminalSentSearch: React.FC<PcTerminalSentSearchProps> = ({ formatDate, onPick }) => {
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
    setNodeCount(nodes.length);
    setPending(nodes.length);
    const timer = window.setTimeout(() => {
      nodes.forEach((node) => {
        pycoreNodeClient(node.url).terminal.searchTerminalLogs(needle, NODE_SEARCH_TIMEOUT_MS)
          .then((result) => {
            if (request !== requestRef.current) return;
            if (!result?.success) {
              setUnreachable((list) => [...list, node.label]);
              return;
            }
            setHits((current) => mergeHits(current, (result.results ?? []).map((hit) => ({ ...hit, node }))));
          })
          .catch(() => {
            if (request === requestRef.current) setUnreachable((list) => [...list, node.label]);
          })
          .finally(() => {
            if (request === requestRef.current) setPending((count) => Math.max(0, count - 1));
          });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, t]);

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
                key={`${hit.node.url ?? 'primary'}-${hit.terminal_number}-${hit.id}`}
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
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-500/10 px-1 text-slate-600 dark:text-slate-300">
                    <PcOsIcon os={pcOsKind(hit.node.os)} />
                    <span className="max-w-[7rem] truncate">{hit.node.label}</span>
                  </span>
                  <span className="truncate font-semibold text-indigo-600 dark:text-indigo-300">
                    {t('terminal.sentSearch.target', { number: hit.terminal_number, name: hit.title || t('terminal.untitled') })}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums text-slate-400">{formatDate(hit.date)}</span>
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
