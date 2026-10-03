import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getBrowserId } from '@/apps/pycore-manager/api';
import type { TerminalScreenshotResourceMeta, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { RELAY_CONTRACT } from '@/core/contracts/RelayContract';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import {
  TERMINAL_FOCUS_POLL_MS,
  TerminalFrameStore,
  terminalFramePolicy,
  type TerminalFrame,
} from '@/apps/pycore-manager/components/terminal/terminalFrames';
import { usePcTerminalVisibility } from '@/apps/pycore-manager/components/terminal/usePcTerminalVisibility';

const DEMAND_RENEW_MS = RELAY_CONTRACT.durations.terminal_viewer_demand_lease_seconds * 500;
const MAX_DEMANDED_WINDOWS = 64;

export interface PcTerminalFrames {
  imageFor: (windowInfo: TerminalWindowInfo | null) => TerminalFrame | null;
  /** Changes whenever a frame was stored (re-render trigger). */
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
  /** The window clicked by position on its picture: it gets image frames instead of text. */
  imageWindowId?: string | null;
}

function finishedAtOf(windowInfo: TerminalWindowInfo): number | null {
  const activity = windowInfo.agent_activity;
  return activity && !activity.busy && typeof activity.finished_at === 'number' ? activity.finished_at : null;
}

export function usePcTerminalFrames({ windows, focusWindowId, imageWindowId = null }: Options): PcTerminalFrames {
  const terminalApi = usePcTerminalApi();
  const store = useMemo(
    () => new TerminalFrameStore(
      (windowId, digest, timeoutMs) => terminalApi.getTerminalScreenshot(windowId, digest, timeoutMs),
      (windowId, digest, timeoutMs) => terminalApi.getTerminalScreenshotText(windowId, digest, timeoutMs),
    ),
    [terminalApi],
  );
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
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
    () => store.framelessWindows(windows, Date.now()),
    // version: a stored frame removes its window from the frameless set.
    [store, windows, version],
  );

  const policy = useMemo(
    () => terminalFramePolicy({ windows, visible, focusId: focusWindowId, frozen, frameless, bootstrap, hidden }),
    [windows, visible, focusWindowId, frozen, frameless, bootstrap, hidden],
  );
  demandIdsRef.current = policy.demand.slice(0, MAX_DEMANDED_WINDOWS);

  useEffect(() => { store.setWanted(policy.wanted); }, [store, policy.wanted]);
  useEffect(() => { store.setImageRequired(new Set(imageWindowId ? [imageWindowId] : [])); }, [store, imageWindowId]);

  const renew = useCallback(() => {
    const forced = [...forceQueue.current];
    forceQueue.current.clear();
    void terminalApi.renewTerminalViewerDemand(getBrowserId(), demandIdsRef.current, {
      focusWindowId: policy.focus || undefined,
      forceWindowIds: forced,
    }).then((result) => {
      Object.values(result?.screenshots ?? {}).forEach((meta) => store.offer(meta));
      forced.forEach((id) => store.fetchNow(id));
    }).catch(() => undefined);
  }, [store, terminalApi, policy.focus]);
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

  const offerSnapshot = useCallback((next: readonly TerminalWindowInfo[]) => {
    store.reconcile(next);
    next.forEach((windowInfo) => { if (windowInfo.online) store.offer(windowInfo.screenshot_resource); });
  }, [store]);

  const receive = useCallback((meta: TerminalScreenshotResourceMeta) => {
    store.offer(meta);
    store.fetchNow(meta.window_id);
  }, [store]);

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

  return { imageFor, version, refFor, demandIdsRef, offerSnapshot, receive, forceLatest, thaw, isFrozen };
}
