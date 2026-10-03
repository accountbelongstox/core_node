import { useCallback, useEffect, useRef } from 'react';
import type { PcUiSessionInput } from './PcUiSessionStore';

const SCROLL_RESTORE_TIMEOUT_MS = 4000;
const SCROLL_RESTORE_POLL_MS = 100;
const SCROLL_SAVE_THROTTLE_MS = 150;
const SCROLL_TOLERANCE_PX = 1;
const INPUT_RESTORE_TIMEOUT_MS = 3000;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

// Content grows while data loads, so the target offset may not be reachable yet: retry on a short
// interval until it is reached, the user takes over the scroll, or the timeout passes.
export function restoreScrollTop(element: HTMLElement, target: number): () => void {
  if (!(target > 0)) return () => undefined;
  let finished = false;
  const startedAt = Date.now();
  const timer = window.setInterval(() => attempt(), SCROLL_RESTORE_POLL_MS);
  function finish() {
    if (finished) return;
    finished = true;
    window.clearInterval(timer);
    USER_SCROLL_EVENTS.forEach((name) => element.removeEventListener(name, finish));
  }
  function attempt() {
    if (finished) return;
    element.scrollTop = target;
    if (Math.abs(element.scrollTop - target) <= SCROLL_TOLERANCE_PX || Date.now() - startedAt > SCROLL_RESTORE_TIMEOUT_MS) {
      finish();
    }
  }
  USER_SCROLL_EVENTS.forEach((name) => element.addEventListener(name, finish, { passive: true }));
  attempt();
  return finish;
}

export function trackScrollTop(element: HTMLElement, onScroll: (scrollTop: number) => void): () => void {
  let last = 0;
  let pending: number | null = null;
  const flush = () => {
    pending = null;
    last = Date.now();
    onScroll(element.scrollTop);
  };
  const handler = () => {
    if (pending !== null) return;
    const wait = Math.max(0, SCROLL_SAVE_THROTTLE_MS - (Date.now() - last));
    pending = window.setTimeout(flush, wait);
  };
  element.addEventListener('scroll', handler, { passive: true });
  return () => {
    element.removeEventListener('scroll', handler);
    if (pending !== null) window.clearTimeout(pending);
  };
}

interface PcTextInputSessionOptions {
  slot: string;
  enabled: boolean;
  value: string;
  restore: PcUiSessionInput | null;
  onRestored: () => void;
  onSnapshot: (input: PcUiSessionInput) => void;
}

// Records whether the textarea is focused, its caret and its scroll, and replays a saved snapshot
// exactly once: the keyboard is only raised for a field the user was typing in, never re-raised
// by later renders.
export function usePcTextInputSession(options: PcTextInputSessionOptions) {
  const { slot, enabled, value, restore, onRestored, onSnapshot } = options;
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  const leavingRef = useRef(false);
  const consumedRef = useRef(false);
  const restoringRef = useRef(false);
  restoringRef.current = restore !== null && restore.slot === slot && !consumedRef.current;
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;

  const snapshot = useCallback((focused: boolean) => {
    const element = elementRef.current;
    if (!element || restoringRef.current) return;
    onSnapshotRef.current({
      slot,
      focused,
      selectionStart: element.selectionStart ?? 0,
      selectionEnd: element.selectionEnd ?? 0,
      scrollTop: element.scrollTop,
    });
  }, [slot]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    leavingRef.current = false;
    const onFocus = () => snapshot(true);
    const onBlur = () => {
      // A window or tab losing focus keeps the field as the active element: that is not the user leaving it.
      if (leavingRef.current || document.activeElement === element) return;
      snapshot(false);
    };
    const onSelectionChange = () => {
      if (document.activeElement === element) snapshot(true);
    };
    const stopScrollTracking = trackScrollTop(element, () => snapshot(document.activeElement === element));
    element.addEventListener('focus', onFocus);
    element.addEventListener('blur', onBlur);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      leavingRef.current = true;
      stopScrollTracking();
      element.removeEventListener('focus', onFocus);
      element.removeEventListener('blur', onBlur);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [snapshot]);

  const restoreActive = restoringRef.current;
  const restoreEnd = restore?.selectionEnd ?? 0;
  const restoreStart = restore?.selectionStart ?? 0;
  const restoreScrollTopValue = restore?.scrollTop ?? 0;
  const restoreFocused = restore?.focused === true;
  useEffect(() => {
    const element = elementRef.current;
    if (!restoreActive || !enabled || !element) return undefined;
    const apply = (clamp: boolean) => {
      if (!restoringRef.current) return;
      const length = element.value.length;
      if (!clamp && length < restoreEnd) return;
      consumedRef.current = true;
      restoringRef.current = false;
      if (restoreFocused) element.focus({ preventScroll: true });
      element.setSelectionRange(Math.min(restoreStart, length), Math.min(restoreEnd, length));
      element.scrollTop = restoreScrollTopValue;
      onRestoredRef.current();
      snapshot(restoreFocused && document.activeElement === element);
    };
    // The draft text arrives after the terminal is selected: wait for it so the caret lands inside it.
    apply(false);
    const timer = window.setTimeout(() => apply(true), INPUT_RESTORE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, restoreActive, restoreEnd, restoreFocused, restoreScrollTopValue, restoreStart, snapshot, value]);

  const cancelRestore = useCallback(() => {
    if (!restoringRef.current) return;
    consumedRef.current = true;
    restoringRef.current = false;
    onRestoredRef.current();
  }, []);

  return { elementRef, cancelRestore };
}
