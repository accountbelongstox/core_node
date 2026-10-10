import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MobileRefreshHandler = () => Promise<unknown> | void;

export interface MobileChrome {
  title: string | null;
  setTitle: (title: string | null) => void;
  actionsSlot: HTMLElement | null;
  setActionsSlot: (element: HTMLElement | null) => void;
  /** The handler the pull-to-refresh gesture of the shell calls; set by the visible screen. */
  refreshRef: React.MutableRefObject<MobileRefreshHandler | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const MobileChromeContext = createContext<MobileChrome | null>(null);

/** State shared between the app frame and the screen it shows: title, action slot and refresh handler. */
export function useMobileChromeState(): MobileChrome {
  const [title, setTitle] = useState<string | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const refreshRef = useRef<MobileRefreshHandler | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  return useMemo(() => ({ title, setTitle, actionsSlot, setActionsSlot, refreshRef, scrollRef }), [title, actionsSlot]);
}

export const MobileChromeProvider: React.FC<{ value: MobileChrome; children: React.ReactNode }> = ({ value, children }) => (
  <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>
);

export function useMobileChrome(): MobileChrome | null {
  return useContext(MobileChromeContext);
}

/**
 * Screen-level frame bindings: the title for the app bar, optional app bar
 * actions (rendered into the bar's action slot) and the pull-to-refresh handler.
 */
export function useMobileScreenChrome(title: string | undefined, onRefresh: MobileRefreshHandler | undefined): MobileChrome | null {
  const chrome = useMobileChrome();
  const setTitle = chrome?.setTitle;
  const refreshRef = chrome?.refreshRef;
  const hasRefresh = onRefresh !== undefined;
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  useEffect(() => {
    if (!setTitle || title === undefined) return undefined;
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);

  useEffect(() => {
    if (!refreshRef) return undefined;
    refreshRef.current = hasRefresh ? () => handlerRef.current?.() : null;
    return () => {
      refreshRef.current = null;
    };
  }, [refreshRef, hasRefresh]);

  return chrome;
}

export const MobileAppBarActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const chrome = useMobileChrome();
  return chrome?.actionsSlot ? createPortal(children, chrome.actionsSlot) : null;
};
