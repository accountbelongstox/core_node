import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PC_BASE_PATH, PC_PAGES } from '../pcPages';
import {
  clearPcUiSessionFocus,
  readPcUiSessionPage,
  updatePcUiSessionPage,
  updatePcUiSessionPageScroll,
} from './PcUiSessionStore';
import { restoreScrollTop, trackScrollTop } from './PcUiSessionDom';

const INDEX_PAGE_ID = PC_PAGES.find((page) => page.index)?.id ?? '';

function pageIdFromPath(pathname: string): string | null {
  if (pathname !== PC_BASE_PATH && !pathname.startsWith(`${PC_BASE_PATH}/`)) return null;
  const segment = pathname.slice(PC_BASE_PATH.length).split('/').filter(Boolean)[0] ?? '';
  if (!segment) return INDEX_PAGE_ID || null;
  return PC_PAGES.some((page) => page.id === segment) ? segment : null;
}

function isBareEntry(pathname: string): boolean {
  return pageIdFromPath(pathname) === INDEX_PAGE_ID
    && pathname.slice(PC_BASE_PATH.length).split('/').filter(Boolean).length === 0;
}

// The saved page is only honoured when the app is entered without an explicit page. A page that
// no longer exists in the registry is ignored, which leaves the entry on the home page.
function entryRedirectTarget(pathname: string, search: string): string | null {
  if (!isBareEntry(pathname) || search) return null;
  const saved = readPcUiSessionPage();
  if (!saved || saved.id === INDEX_PAGE_ID || !PC_PAGES.some((page) => page.id === saved.id)) return null;
  const savedSearch = saved.search.startsWith('?') ? saved.search : '';
  return `${PC_BASE_PATH}/${saved.id}${savedSearch}`;
}

/** Returns the last operated page on a bare entry, and records every page the user then visits. */
export const PcUiSessionRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [entry] = useState(() => ({
    path: location.pathname,
    target: entryRedirectTarget(location.pathname, location.search),
  }));
  const [redirecting, setRedirecting] = useState(entry.target !== null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (redirecting && location.pathname !== entry.path) setRedirecting(false);
  }, [entry.path, location.pathname, redirecting]);

  useEffect(() => {
    if (redirecting) return;
    const pageId = pageIdFromPath(location.pathname);
    if (!pageId) return;
    const saved = readPcUiSessionPage();
    // The first recorded location is the restored one; later changes are the user moving around.
    if (navigatedRef.current && saved?.id !== pageId) clearPcUiSessionFocus();
    navigatedRef.current = true;
    updatePcUiSessionPage({ id: pageId, search: location.search });
  }, [location.pathname, location.search, redirecting]);

  if (redirecting && entry.target) return <Navigate to={entry.target} replace />;
  return <>{children}</>;
};

/** Persists the scroll position of the page scroller and replays it once, when the layout mounts. */
export function usePcPageScrollSession(scrollerRef: React.RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const pageIdRef = useRef<string | null>(pageIdFromPath(pathname));
  pageIdRef.current = pageIdFromPath(pathname);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return undefined;
    const saved = readPcUiSessionPage();
    const stopRestoring = saved && saved.id === pageIdRef.current
      ? restoreScrollTop(element, saved.scrollTop)
      : () => undefined;
    const stopTracking = trackScrollTop(element, (scrollTop) => {
      if (pageIdRef.current) updatePcUiSessionPageScroll(pageIdRef.current, scrollTop);
    });
    return () => {
      stopRestoring();
      stopTracking();
    };
  }, [scrollerRef]);
}
