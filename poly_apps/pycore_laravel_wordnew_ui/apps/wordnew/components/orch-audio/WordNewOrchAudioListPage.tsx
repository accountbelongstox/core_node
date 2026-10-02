import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, ListMusic, LogIn, Play } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import type { ElementTheme } from '../../WfNewThemes';
import {
  wfNewApi,
  type WfNewOrchAudioItem,
  type WfNewOrchAudioSource,
  type WfNewOrchAudioSourceCount,
} from '../../api';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';
import { ORCH_AUDIO_DEFAULT_PAGE_SIZE } from '../../api/methods/orchAudio';
import type { WordNewOrchAudioRoute } from '../../routing/WordNewHashRoutes';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { WfNewPager } from '../WfNewPager';
import { OrchEmptyBox } from '../orch-compose/orchPanels';
import { OrchListRow, OrchMetaItem, OrchSegmentMeta } from '../orch-compose/OrchListRow';
import { OrchTabs } from '../orch-compose/OrchTabs';
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

const ALL_SOURCES = '';

export const WordNewOrchAudioSourceBadge: React.FC<{
  source: WfNewOrchAudioSource;
  trans: Props['trans'];
}> = ({ source, trans }) => {
  const view = orchAudioSourceView(source);
  return <Pill icon={view.icon} tone={view.tone} className="font-bold">{orchAudioSourceLabel(source, trans)}</Pill>;
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
  const requestIdRef = useRef(0);
  const perPage = ORCH_AUDIO_DEFAULT_PAGE_SIZE;

  useEffect(() => {
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
  }, [route.source, route.page, perPage]);

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
        <OrchTabs
          value={route.source ?? ALL_SOURCES}
          options={filters.map((source) => ({
            value: source ?? ALL_SOURCES,
            label: (
              <>
                {source ? orchAudioSourceLabel(source, trans) : trans('orchAudio.filterAll')}
                {source && countBySource.get(source) ? <span className="font-mono opacity-60">{countBySource.get(source)}</span> : null}
              </>
            ),
          }))}
          onChange={(source) => onNavigate({ source: source === ALL_SOURCES ? null : source, page: 1 })}
          theme={theme}
          role="radio"
          shape="pill"
        />
        {loading && <WfNewLoadingDots className="text-indigo-300" label={trans('content.loading')} />}
      </div>

      {!loading && items.length === 0 ? (
        <OrchEmptyBox icon={AudioLines}>{trans(failed ? 'orchAudio.loadFailed' : 'orchAudio.empty')}</OrchEmptyBox>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <OrchListRow
              key={item.id}
              theme={theme}
              icon={Play}
              title={item.title}
              badges={<WordNewOrchAudioSourceBadge source={item.source} trans={trans} />}
              subtitle={item.previewText}
              meta={(
                <>
                  <OrchSegmentMeta segmentCount={item.segmentCount} durationSec={item.durationSec} trans={trans} />
                  <OrchMetaItem icon={ListMusic}>{trans('orchAudio.sentenceCount', { count: item.sentenceCount })}</OrchMetaItem>
                  {item.createdAt && <span>{new Date(item.createdAt).toLocaleString()}</span>}
                </>
              )}
              onOpen={() => onNavigate({ itemId: item.id })}
            />
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
