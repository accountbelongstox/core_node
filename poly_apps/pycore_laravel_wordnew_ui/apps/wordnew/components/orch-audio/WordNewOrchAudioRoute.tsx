import React, { useCallback, useEffect, useState } from 'react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  navigateToOrchAudio,
  parseOrchAudioHash,
  type WordNewOrchAudioRoute as OrchAudioRoute,
} from '../../routing/WordNewHashRoutes';
import { WordNewOrchAudioListPage } from './WordNewOrchAudioListPage';
import { WordNewOrchAudioPlayerPage } from './WordNewOrchAudioPlayerPage';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
}

function currentRoute(): OrchAudioRoute {
  return parseOrchAudioHash(typeof window === 'undefined' ? '' : window.location.hash);
}

/** `#/orch-audio[?source=&page=]` lists items; `#/orch-audio/<id>` plays one. */
export const WordNewOrchAudioRoute: React.FC<Props> = ({ theme, trans, dark }) => {
  const [route, setRoute] = useState<OrchAudioRoute>(currentRoute);
  const [listRoute, setListRoute] = useState<Partial<OrchAudioRoute>>({});

  useEffect(() => {
    const handleHashChange = (): void => setRoute(currentRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!route.itemId) setListRoute({ source: route.source, page: route.page });
  }, [route]);

  const backToList = useCallback(() => navigateToOrchAudio(listRoute), [listRoute]);

  return route.itemId ? (
    <WordNewOrchAudioPlayerPage itemId={route.itemId} theme={theme} trans={trans} dark={dark} onBack={backToList} />
  ) : (
    <WordNewOrchAudioListPage theme={theme} trans={trans} route={route} onNavigate={navigateToOrchAudio} />
  );
};
