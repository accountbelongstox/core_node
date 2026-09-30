import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, CloudDownload } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  navigateToOrchAudio,
  parseOrchAudioHash,
  type WordNewOrchAudioRoute as OrchAudioRoute,
  type WordNewOrchAudioView,
} from '../../routing/WordNewHashRoutes';
import { WordNewOrchAudioListPage } from './WordNewOrchAudioListPage';
import { WordNewOrchAudioPlayerPage } from './WordNewOrchAudioPlayerPage';
import { WordNewOrchComposeList } from '../orch-compose/WordNewOrchComposeList';
import { WordNewOrchComposeDetail } from '../orch-compose/WordNewOrchComposeDetail';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
}

const VIEWS: Array<{ id: WordNewOrchAudioView; labelKey: string; icon: typeof Clapperboard }> = [
  { id: 'compose', labelKey: 'orchCompose.tab.compose', icon: Clapperboard },
  { id: 'delivered', labelKey: 'orchCompose.tab.delivered', icon: CloudDownload },
];

function currentRoute(): OrchAudioRoute {
  return parseOrchAudioHash(typeof window === 'undefined' ? '' : window.location.hash);
}

/**
 * `#/orch-audio` shows the client compositions (`#/orch-audio/<id>` plays one);
 * `?view=delivered` lists pycore output delivered to Laravel
 * (`#/orch-audio/<task key>` plays it).
 */
export const WordNewOrchAudioRoute: React.FC<Props> = ({ theme, trans, dark }) => {
  const [route, setRoute] = useState<OrchAudioRoute>(currentRoute);
  const [listRoute, setListRoute] = useState<Partial<OrchAudioRoute>>({});

  useEffect(() => {
    const handleHashChange = (): void => setRoute(currentRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!route.itemId) setListRoute({ view: route.view, source: route.source, page: route.page });
  }, [route]);

  const backToList = useCallback(() => navigateToOrchAudio({ ...listRoute, view: route.view }), [listRoute, route.view]);
  const navigateDelivered = useCallback(
    (next: Partial<OrchAudioRoute>) => navigateToOrchAudio({ ...next, view: 'delivered' }),
    [],
  );

  if (route.itemId) {
    return route.view === 'delivered' ? (
      <WordNewOrchAudioPlayerPage itemId={route.itemId} theme={theme} trans={trans} dark={dark} onBack={backToList} />
    ) : (
      <WordNewOrchComposeDetail taskId={route.itemId} theme={theme} trans={trans} onBack={backToList} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist">
        {VIEWS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={route.view === id}
            onClick={() => navigateToOrchAudio({ view: id })}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              route.view === id ? theme.accentBg : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{trans(labelKey)}
          </button>
        ))}
      </div>
      {route.view === 'delivered' ? (
        <WordNewOrchAudioListPage theme={theme} trans={trans} route={route} onNavigate={navigateDelivered} />
      ) : (
        <WordNewOrchComposeList theme={theme} trans={trans} onOpen={(id) => navigateToOrchAudio({ itemId: id })} />
      )}
    </div>
  );
};
