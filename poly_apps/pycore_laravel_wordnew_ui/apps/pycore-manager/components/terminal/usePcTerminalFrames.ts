import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getBrowserId } from '@/apps/pycore-manager/api';
import type { TerminalScreenshotResourceMeta, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { RELAY_CONTRACT } from '@/core/contracts/RelayContract';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import {
  TERMINAL_FOCUS_POLL_MS,
  TerminalImageFrameStore,
  TerminalImageTransport,
  TerminalTextStore,
  TerminalTextTransport,
  selectTerminalView,
  terminalFramePolicy,
  terminalNeedsImage,
  type TerminalFrame,
  type TerminalTextDoc,
  type TerminalTextTarget,
  type TerminalView,
  type TerminalViewMode,
} from '@/apps/pycore-manager/components/terminal/terminalFrames';
import { usePcTerminalVisibility } from '@/apps/pycore-manager/components/terminal/usePcTerminalVisibility';

const DEMAND_RENEW_MS = RELAY_CONTRACT.durations.terminal_viewer_demand_lease_seconds * 500;
const MAX_DEMANDED_WINDOWS = 64;

export interface PcTerminalFrames {
  imageFor: (windowInfo: TerminalWindowInfo | null) => TerminalFrame | null;
  textFor: (windowInfo: TerminalWindowInfo | null) => TerminalTextDoc | null;
  /** What to show: text while it matches the screen, else the picture (or the mode forced for that window). */
  viewFor: (windowInfo: TerminalWindowInfo | null) => TerminalView | null;
  /** Changes whenever a frame or text was stored (re-render trigger). */
  version: number;
  refFor: (windowId: string) => (element: Element | null) => void;
  /** Window ids the server lease demands now (for snapshot requests). */
  demandIdsRef: React.MutableRefObject<string[]>;
  /** Snapshot answer: remember every window's newest frame metadata, forget windows that left. */
  offerSnapshot: (windows: readonly TerminalWindowInfo[]) => void;
  /** A frame an action produced: fetched at once, whatever the policy says. */
  receive: (meta: TerminalScreenshotResourceMeta) => void;
  /** Capture and fetch the window's newest frame now (an opened terminal, the last frame of a finished one). */
  forceLatest: (windowId: string) => void;
  /** A prompt was sent to the terminal: its finished state no longer freezes frames. */
  thaw: (terminalNumber: number) => void;
  isFrozen: (windowInfo: TerminalWindowInfo | null) => boolean;
}

interface Options {
  windows: readonly TerminalWindowInfo[];
  /** The terminal being operated; its window is polled once a second and every other one is paused. */
  focusWindowId: string | null;
  /** A view mode forced for one window (the previewed one); every other window is 'auto'. */
  forcedView?: { windowId: string | null; mode: TerminalViewMode };
}

const AUTO_VIEW = { windowId: null, mode: 'auto' as const };

function finishedAtOf(windowInfo: TerminalWindowInfo): number | null {
  const activity = windowInfo.agent_activity;
  return activity && !activity.busy && typeof activity.finished_at === 'number' ? activity.finished_at : null;
}

export function usePcTerminalFrames({ windows, focusWindowId, forcedView = AUTO_VIEW }: Options): PcTerminalFrames {
  const terminalApi = usePcTerminalApi();
  const store = useMemo(
    () => new TerminalImageFrameStore(new TerminalImageTransport(
      (windowId, digest, timeoutMs) => terminalApi.getTerminalScreenshot(windowId, digest, timeoutMs),
    )),
    [terminalApi],
  );
  const textStore = useMemo(
    () => new TerminalTextStore(new TerminalTextTransport(
      (windowId, terminalNumber, revision, refresh, timeoutMs) => terminalApi.getTerminalText(windowId, terminalNumber, revision, refresh, timeoutMs),
    )),
    [terminalApi],
  );
  const imageVersion = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const textVersion = useSyncExternalStore(textStore.subscribe, textStore.getVersion, textStore.getVersion);
  const version = imageVersion + textVersion;
  const modeFor = useCallback(
    (windowId: string): TerminalViewMode => (forcedView.windowId === windowId ? forcedView.mode : 'auto'),
    [forcedView.windowId, forcedView.mode],
  );
  const { visible, refFor } = usePcTerminalVisibility();
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [thawVersion, setThawVersion] = useState(0);
  const thawed = useRef(new Map<number, number>());
  const forceQueue = useRef(new Set<string>());
  const demandIdsRef = useRef<string[]>([]);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  useEffect(() => {
    const onVisibility = (): void => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    store.open();
    return () => store.dispose();
  }, [store]);

  useEffect(() => {
    textStore.open();
    return () => textStore.dispose();
  }, [textStore]);

  const frozen = useMemo(() => {
    const ids = new Set<string>();
    windows.forEach((windowInfo) => {
      const finishedAt = finishedAtOf(windowInfo);
      if (finishedAt !== null && finishedAt > (thawed.current.get(windowInfo.terminal_number) ?? 0)) ids.add(windowInfo.id);
    });
    return ids;
    // thawVersion re-evaluates after thaw() changed the map.
  }, [windows, thawVersion]);

  const { frameless, bootstrap } = useMemo(
    () => store.framelessWindows(windows, Date.now(), (windowId) => textStore.docFor(windowId) !== null),
    // version: a stored frame or text removes its window from the frameless set.
    [store, textStore, windows, version],
  );

  const policy = useMemo(
    () => terminalFramePolicy({ windows, visible, focusId: focusWindowId, frozen, frameless, bootstrap, hidden }),
    [windows, visible, focusWindowId, frozen, frameless, bootstrap, hidden],
  );
  demandIdsRef.current = policy.demand.slice(0, MAX_DEMANDED_WINDOWS);

  // Text goes to every window on screen (a static one only answers "same"); the operated one alone while it is.
  const textTargetsKey = useMemo(() => {
    if (hidden) return '';
    const online = windows.filter((windowInfo) => windowInfo.online);
    const focused = focusWindowId ? online.filter((windowInfo) => windowInfo.id === focusWindowId) : [];
    const targets = focused.length
      ? focused
      : online.filter((windowInfo) => visible.has(windowInfo.id) || bootstrap.has(windowInfo.id));
    return JSON.stringify(targets.map((windowInfo): TerminalTextTarget => ({
      windowId: windowInfo.id,
      terminalNumber: windowInfo.terminal_number,
    })));
  }, [windows, visible, bootstrap, focusWindowId, hidden]);
  useEffect(() => {
    textStore.setTargets(textTargetsKey ? JSON.parse(textTargetsKey) as TerminalTextTarget[] : [], focusWindowId);
  }, [textStore, textTargetsKey, focusWindowId]);

  // The picture travels only where the text cannot stand in for it (missing, outdated or not wanted).
  const imageWanted = useMemo(() => {
    const wanted = new Set<string>();
    policy.wanted.forEach((windowId) => {
      const text = textStore.docFor(windowId);
      const waitingForText = text === null && !textStore.isUnavailable(windowId) && modeFor(windowId) !== 'image';
      if (!waitingForText && terminalNeedsImage(text, modeFor(windowId))) wanted.add(windowId);
    });
    return wanted;
    // textVersion: text arriving, failing or turning stale changes which windows need their picture.
  }, [policy.wanted, textStore, textVersion, modeFor]);
  useEffect(() => { store.setWanted(imageWanted); }, [store, imageWanted]);

  const renew = useCallback(() => {
    const forced = [...forceQueue.current];
    forceQueue.current.clear();
    void terminalApi.renewTerminalViewerDemand(getBrowserId(), demandIdsRef.current, {
      focusWindowId: policy.focus || undefined,
      forceWindowIds: forced,
    }).then((result) => {
      Object.values(result?.screenshots ?? {}).forEach((meta) => store.offer(meta));
      forced.forEach((id) => {
        store.fetchNow(id);
        textStore.pollSoon(id);
      });
    }).catch(() => undefined);
  }, [store, textStore, terminalApi, policy.focus]);
  const renewRef = useRef(renew);
  renewRef.current = renew;

  const demandKey = `${policy.demand.join('|')}#${policy.focus}`;
  useEffect(() => {
    renewRef.current();
    if (!policy.demand.length && !policy.focus) return undefined;
    const timer = window.setInterval(() => renewRef.current(), policy.focus ? TERMINAL_FOCUS_POLL_MS : DEMAND_RENEW_MS);
    return () => window.clearInterval(timer);
    // demandKey carries the demand list and focus; renew is read through the ref.
  }, [demandKey]);

  // A terminal that just finished keeps its last frame: capture it once as it turns static.
  const wasFrozen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = wasFrozen.current;
    wasFrozen.current = frozen;
    if (before === null) return;
    frozen.forEach((id) => {
      if (!before.has(id)) {
        forceQueue.current.add(id);
        renewRef.current();
      }
    });
  }, [frozen]);

  const imageFor = useCallback(
    (windowInfo: TerminalWindowInfo | null) => (windowInfo?.online ? store.imageFor(windowInfo.id) : null),
    [store],
  );

  const textFor = useCallback(
    (windowInfo: TerminalWindowInfo | null) => (windowInfo?.online ? textStore.docFor(windowInfo.id) : null),
    [textStore],
  );

  const viewFor = useCallback(
    (windowInfo: TerminalWindowInfo | null) => (windowInfo?.online
      ? selectTerminalView(textStore.docFor(windowInfo.id), store.imageFor(windowInfo.id), modeFor(windowInfo.id))
      : null),
    [store, textStore, modeFor],
  );

  const offerSnapshot = useCallback((next: readonly TerminalWindowInfo[]) => {
    textStore.forget(new Set(next.filter((windowInfo) => windowInfo.online).map((windowInfo) => windowInfo.id)));
    store.reconcile(next);
    next.forEach((windowInfo) => { if (windowInfo.online) store.offer(windowInfo.screenshot_resource); });
  }, [store, textStore]);

  const receive = useCallback((meta: TerminalScreenshotResourceMeta) => {
    store.offer(meta);
    textStore.pollSoon(meta.window_id);
    if (terminalNeedsImage(textStore.docFor(meta.window_id), modeFor(meta.window_id))) store.fetchNow(meta.window_id);
  }, [store, textStore, modeFor]);

  const forceLatest = useCallback((windowId: string) => {
    forceQueue.current.add(windowId);
    renewRef.current();
  }, []);

  const thaw = useCallback((terminalNumber: number) => {
    const windowInfo = windowsRef.current.find((entry) => entry.terminal_number === terminalNumber);
    const finishedAt = windowInfo?.agent_activity?.finished_at;
    if (typeof finishedAt !== 'number') return;
    thawed.current.set(terminalNumber, finishedAt);
    setThawVersion((value) => value + 1);
  }, []);

  const isFrozen = useCallback((windowInfo: TerminalWindowInfo | null) => (windowInfo ? frozen.has(windowInfo.id) : false), [frozen]);

  return { imageFor, textFor, viewFor, version, refFor, demandIdsRef, offerSnapshot, receive, forceLatest, thaw, isFrozen };
}
