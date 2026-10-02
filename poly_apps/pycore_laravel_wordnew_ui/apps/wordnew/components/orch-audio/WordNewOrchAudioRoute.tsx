import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, CloudDownload } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  navigateToOrchAudio,
  parseOrchAudioHash,
  type WordNewOrchAudioRoute as OrchAudioRoute,
  type WordNewOrchAudioView,
} from '../../routing/WordNewHashRoutes';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';
import { WordNewOrchAudioListPage, WordNewOrchAudioLoginPrompt } from './WordNewOrchAudioListPage';
import { WordNewOrchAudioPlayerPage } from './WordNewOrchAudioPlayerPage';
import { WordNewOrchComposeList } from '../orch-compose/WordNewOrchComposeList';
import { WordNewOrchComposeDetail } from '../orch-compose/WordNewOrchComposeDetail';
import { WordNewOrchComposePlayerPage } from '../orch-compose/WordNewOrchComposePlayerPage';
import { OrchTabs } from '../orch-compose/OrchTabs';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
  isLoggedIn: boolean;
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
export const WordNewOrchAudioRoute: React.FC<Props> = ({ theme, trans, dark, isLoggedIn }) => {
  const [route, setRoute] = useState<OrchAudioRoute>(currentRoute);
  const [listRoute, setListRoute] = useState<Partial<OrchAudioRoute>>({});

  // The page a composition player was opened from (its resources page or the list) is where back returns.
  const [playerFrom, setPlayerFrom] = useState<OrchAudioRoute | null>(null);
  const routeRef = useRef(route);

  useEffect(() => {
    const handleHashChange = (): void => {
      const previous = routeRef.current;
      const next = currentRoute();
      if (next.mode === 'play' && (previous.itemId !== next.itemId || previous.mode !== 'play')) setPlayerFrom(previous);
      routeRef.current = next;
      setRoute(next);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!route.itemId) setListRoute({ view: route.view, source: route.source, page: route.page });
  }, [route]);

  const backToList = useCallback(() => navigateToOrchAudio({ ...listRoute, view: route.view }), [listRoute, route.view]);
  const backFromPlayer = useCallback(() => {
    if (playerFrom?.itemId === route.itemId && playerFrom?.mode === 'detail') navigateToOrchAudio({ itemId: route.itemId });
    else backToList();
  }, [playerFrom, route.itemId, backToList]);
  const navigateDelivered = useCallback(
    (next: Partial<OrchAudioRoute>) => navigateToOrchAudio({ ...next, view: 'delivered' }),
    [],
  );

  useEffect(() => {
    if (!isLoggedIn) requestAuthLogin({ source: 'wordnew-orch-audio', reason: 'protected-feature' });
  }, [isLoggedIn]);

  if (!isLoggedIn) return <WordNewOrchAudioLoginPrompt theme={theme} trans={trans} />;

  if (route.itemId) {
    return route.view === 'delivered' ? (
      <WordNewOrchAudioPlayerPage itemId={route.itemId} theme={theme} trans={trans} dark={dark} onBack={backToList} />
    ) : route.mode === 'play' ? (
      <WordNewOrchComposePlayerPage
        taskId={route.itemId}
        theme={theme}
        trans={trans}
        onBack={backFromPlayer}
        onOpenResources={() => navigateToOrchAudio({ itemId: route.itemId })}
      />
    ) : (
      <WordNewOrchComposeDetail
        taskId={route.itemId}
        theme={theme}
        trans={trans}
        onBack={backToList}
        onOpenPlayer={() => navigateToOrchAudio({ itemId: route.itemId, mode: 'play' })}
      />
    );
  }

  return (
    <div className="space-y-5">
      <OrchTabs
        value={route.view}
        options={VIEWS.map(({ id, labelKey, icon: Icon }) => ({ value: id, label: <><Icon className="h-3.5 w-3.5" />{trans(labelKey)}</> }))}
        onChange={(view) => navigateToOrchAudio({ view })}
        theme={theme}
        shape="md"
      />
      {route.view === 'delivered' ? (
        <WordNewOrchAudioListPage theme={theme} trans={trans} route={route} onNavigate={navigateDelivered} />
      ) : (
        <WordNewOrchComposeList
          theme={theme}
          trans={trans}
          onOpen={(id) => navigateToOrchAudio({ itemId: id })}
          onPlay={(id) => navigateToOrchAudio({ itemId: id, mode: 'play' })}
        />
      )}
    </div>
  );
};
