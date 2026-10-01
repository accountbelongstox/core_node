/**
 * usePcHistory — the ONE history hook: lists one or several history stores
 * (hub test records, image / search / translate / speech stores) as normalized
 * rows and owns delete / clear for them. A hub model scope refreshes from the
 * `ai_hub.history.changed` topic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PYCORE_EVENT_TOPICS, PYCORE_HTTP_DEFAULTS } from '@/apps/pycore-manager/api';
import {
  PC_HISTORY_DEFAULT_LIMIT,
  PC_HISTORY_FEED_KINDS,
  PC_HISTORY_KINDS,
  PC_HISTORY_SOURCES,
  type PcHistoryKind,
  type PcHistoryQuery,
  type PcHistoryRow,
} from '../utils/pcHistorySources';
import { usePycoreTopicRefresh } from '../../../core/integrations/pycore/usePycoreTopicRefresh';

export interface PcHistoryScope {
  kinds?: PcHistoryKind[];
  /** Hub entry key ("tts:azure"): scopes to that model's test records. */
  modelKey?: string;
  category?: string;
  limit?: number;
}

/** A history kind, a hub model key, or a full scope. */
export type PcHistoryTarget = PcHistoryKind | string | PcHistoryScope | undefined;

export interface PcHistory {
  rows: PcHistoryRow[];
  kinds: PcHistoryKind[];
  counts: Record<string, number>;
  /** A source returned its full limit: more records exist than are listed. */
  capped: boolean;
  loading: boolean;
  unreachable: boolean;
  refresh: () => Promise<void>;
  remove: (row: PcHistoryRow) => Promise<void>;
  clear: (kind?: PcHistoryKind) => Promise<void>;
}

function resolveScope(target: PcHistoryTarget): PcHistoryScope {
  if (!target) return {};
  if (typeof target === 'object') return target;
  if ((PC_HISTORY_KINDS as string[]).includes(target)) return { kinds: [target as PcHistoryKind] };
  return { modelKey: target };
}

export function usePcHistory(target?: PcHistoryTarget): PcHistory {
  const { t } = useTranslation('pc');
  const scope = resolveScope(target);
  const kinds = scope.kinds ?? (scope.modelKey || scope.category ? ['hub' as const] : PC_HISTORY_FEED_KINDS);
  const kindsKey = kinds.join(',');
  const query = useMemo<PcHistoryQuery>(
    () => ({ key: scope.modelKey, category: scope.category, limit: scope.limit ?? PC_HISTORY_DEFAULT_LIMIT }),
    [scope.modelKey, scope.category, scope.limit],
  );
  const kindsRef = useRef(kinds);
  kindsRef.current = kinds;

  const [rows, setRows] = useState<PcHistoryRow[]>([]);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  /** Last answer per source (null = unreachable): a change of one source reloads only that one. */
  const bySource = useRef(new Map<PcHistoryKind, PcHistoryRow[] | null>());

  const loadKinds = useCallback(async (only?: PcHistoryKind[]) => {
    setLoading(true);
    const active = kindsRef.current;
    const targets = only ? active.filter((kind) => only.includes(kind)) : active;
    const results = await Promise.allSettled(targets.map((kind) => PC_HISTORY_SOURCES[kind].load(query, t)));
    results.forEach((result, index) => {
      bySource.current.set(targets[index], result.status === 'fulfilled' ? result.value : null);
    });
    const answers = active.map((kind) => bySource.current.get(kind) ?? null);
    const merged = answers.flatMap((answer) => answer ?? []);
    merged.sort((a, b) => b.ts - a.ts);
    setRows(merged);
    setCapped(answers.some((answer) => (answer?.length ?? 0) >= (query.limit ?? PC_HISTORY_DEFAULT_LIMIT)));
    setUnreachable(answers.every((answer) => answer === null));
    setLoading(false);
  }, [query, t, kindsKey]);
  const load = useCallback(() => loadKinds(), [loadKinds]);
  const loadHub = useCallback(() => loadKinds(['hub']), [loadKinds]);

  useEffect(() => {
    bySource.current.clear();
    void load();
  }, [load]);

  usePycoreTopicRefresh(
    [PYCORE_EVENT_TOPICS.aiHubHistoryChanged],
    loadHub,
    { enabled: kinds.includes('hub'), fallbackMs: PYCORE_HTTP_DEFAULTS.slowFallbackPollMs },
  );

  const remove = useCallback(async (row: PcHistoryRow) => {
    try {
      await PC_HISTORY_SOURCES[row.kind].remove(row);
      setRows((previous) => previous.filter((item) => item.key !== row.key));
      const kept = bySource.current.get(row.kind);
      if (kept) bySource.current.set(row.kind, kept.filter((item) => item.key !== row.key));
    } catch { /* the next refresh reconciles */ }
  }, []);

  const clear = useCallback(async (kind?: PcHistoryKind) => {
    const targets = kind ? [kind] : kindsRef.current;
    await Promise.allSettled(targets.map((item) => PC_HISTORY_SOURCES[item].clear(query)));
    await load();
  }, [query, load]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: rows.length };
    rows.forEach((row) => { tally[row.kind] = (tally[row.kind] ?? 0) + 1; });
    return tally;
  }, [rows]);

  return { rows, kinds, counts, capped, loading, unreachable, refresh: load, remove, clear };
}
