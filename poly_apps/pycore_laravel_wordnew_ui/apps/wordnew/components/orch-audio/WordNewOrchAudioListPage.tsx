import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Clock, Layers, ListMusic, LogIn, Play } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  wfNewApi,
  type WfNewOrchAudioItem,
  type WfNewOrchAudioSource,
  type WfNewOrchAudioSourceCount,
} from '../../api';
import { requestAuthLogin, subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';
import { ORCH_AUDIO_DEFAULT_PAGE_SIZE } from '../../api/methods/orchAudio';
import type { WordNewOrchAudioRoute } from '../../routing/WordNewHashRoutes';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { WfNewPager } from '../WfNewPager';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import {
  ORCH_AUDIO_KNOWN_SOURCES,
  orchAudioSourceLabel,
  orchAudioSourceView,
} from './orchAudioModel';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  route: WordNewOrchAudioRoute;
  onNavigate: (route: Partial<WordNewOrchAudioRoute>) => void;
}

export const WordNewOrchAudioSourceBadge: React.FC<{
  source: WfNewOrchAudioSource;
  trans: Props['trans'];
}> = ({ source, trans }) => {
  const view = orchAudioSourceView(source);
  const Icon = view.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${view.badgeClass}`}>
      <Icon className="h-3 w-3" />
      {orchAudioSourceLabel(source, trans)}
    </span>
  );
};

/** The read API is sanctum-only: prompt for login instead of an empty list. */
export const WordNewOrchAudioLoginPrompt: React.FC<Pick<Props, 'theme' | 'trans'>> = ({ theme, trans }) => (
  <div className="space-y-4 rounded-2xl border border-dashed border-white/10 p-8 text-center">
    <p className="text-xs font-mono text-zinc-500">{trans('orchAudio.loginRequired')}</p>
    <button
      type="button"
      onClick={() => requestAuthLogin({ source: 'wordnew-orch-audio', reason: 'view' })}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold ${theme.accentBg}`}
    >
      <LogIn className="h-3.5 w-3.5" />{trans('orchAudio.login')}
    </button>
  </div>
);

/** Paged listing of orchestrated audio with a source filter (hash-routed). */
export const WordNewOrchAudioListPage: React.FC<Props> = ({ theme, trans, route, onNavigate }) => {
  const [items, setItems] = useState<WfNewOrchAudioItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<WfNewOrchAudioSourceCount[]>(
    () => ORCH_AUDIO_KNOWN_SOURCES.map((id) => ({ id, count: 0 })),
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [authed, setAuthed] = useState(() => wfNewApi.isAuthenticated());
  const requestIdRef = useRef(0);
  const perPage = ORCH_AUDIO_DEFAULT_PAGE_SIZE;

  useEffect(() => subscribeAuthLoginSuccess(() => setAuthed(wfNewApi.isAuthenticated())), []);

  useEffect(() => {
    if (!authed) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setFailed(false);
    wfNewApi.getOrchAudioPage({ source: route.source, page: route.page, perPage })
      .then((page) => {
        if (requestId !== requestIdRef.current) return;
        setItems(page.items);
        setTotal(page.total);
        if (page.sources.length) setSources(page.sources);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setItems([]);
        setTotal(0);
        setFailed(true);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [authed, route.source, route.page, perPage]);

  if (!authed) return <WordNewOrchAudioLoginPrompt theme={theme} trans={trans} />;

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const countBySource = new Map(sources.map((source) => [source.id, source.count]));
  const filters: Array<WfNewOrchAudioSource | null> = [
    null,
    ...sources.map((source) => source.id),
    ...(route.source && !countBySource.has(route.source) ? [route.source] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((source) => {
          const active = (source ?? null) === (route.source ?? null);
          return (
            <button
              key={source ?? 'all'}
              type="button"
              onClick={() => onNavigate({ source, page: 1 })}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                active ? theme.accentBg : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {source ? orchAudioSourceLabel(source, trans) : trans('orchAudio.filterAll')}
              {source && countBySource.get(source) ? (
                <span className="ml-1.5 font-mono opacity-60">{countBySource.get(source)}</span>
              ) : null}
            </button>
          );
        })}
        {loading && <WfNewLoadingDots className="text-indigo-300" label={trans('content.loading')} />}
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <AudioLines className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
          <p className="text-xs font-mono text-zinc-500">
            {trans(failed ? 'orchAudio.loadFailed' : 'orchAudio.empty')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate({ itemId: item.id })}
                className={`group flex w-full items-start gap-3 rounded-2xl border border-white/5 p-4 text-left transition-all hover:border-indigo-500/30 hover:bg-white/[0.03] ${theme.cardClass}`}
              >
                <span className="mt-0.5 shrink-0 rounded-xl bg-indigo-500/10 p-2.5 text-indigo-300 group-hover:bg-indigo-500/20">
                  <Play className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">{item.title}</span>
                    <WordNewOrchAudioSourceBadge source={item.source} trans={trans} />
                  </span>
                  {item.previewText && (
                    <span className="line-clamp-2 block text-xs leading-relaxed text-zinc-400">{item.previewText}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {trans('orchAudio.segmentCount', { count: item.segmentCount })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ListMusic className="h-3 w-3" />
                      {trans('orchAudio.sentenceCount', { count: item.sentenceCount })}
                    </span>
                    {item.durationSec != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatClockTime(item.durationSec)}
                      </span>
                    )}
                    {item.createdAt && <span>{new Date(item.createdAt).toLocaleString()}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <WfNewPager
        page={route.page}
        totalPages={totalPages}
        atLastPage={route.page >= totalPages}
        loading={loading}
        onGoTo={(page) => onNavigate({ source: route.source, page: Math.max(1, Math.min(page, totalPages)) })}
        trans={trans}
      />
    </div>
  );
};
