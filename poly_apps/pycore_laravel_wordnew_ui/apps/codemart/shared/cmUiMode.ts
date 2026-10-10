import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

export type CmUiMode = 'web' | 'mobile';

/** `?cm_ui=mobile|web` forces a UI and is remembered; `?cm_ui=auto` returns to the platform default. */
export const CM_UI_QUERY_PARAM = 'cm_ui';
export const CM_UI_STORAGE_KEY = 'cm_ui_mode';
const CM_UI_AUTO = 'auto';
const UI_MODES: readonly string[] = ['web', 'mobile'];

const listeners = new Set<() => void>();

function readStored(): CmUiMode | null {
  try {
    const value = window.localStorage.getItem(CM_UI_STORAGE_KEY);
    return value !== null && UI_MODES.includes(value) ? (value as CmUiMode) : null;
  } catch {
    return null;
  }
}

function writeStored(mode: CmUiMode | null): void {
  try {
    if (mode === null) window.localStorage.removeItem(CM_UI_STORAGE_KEY);
    else window.localStorage.setItem(CM_UI_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable: the choice then lasts until the next load */
  }
}

/** Platform default: the Capacitor native app is the mobile UI, every browser is the web UI. */
export function cmDefaultUiMode(): CmUiMode {
  try {
    return Capacitor.isNativePlatform() ? 'mobile' : 'web';
  } catch {
    return 'web';
  }
}

let sessionMode: CmUiMode | null = null;

function applyQueryOverride(): void {
  const requested = new URLSearchParams(window.location.search).get(CM_UI_QUERY_PARAM);
  if (requested === null) return;
  if (requested === CM_UI_AUTO) writeStored(null);
  else if (UI_MODES.includes(requested)) writeStored(requested as CmUiMode);
  else return;
  sessionMode = null;
}

/** The UI that renders now: query override, then the remembered choice, then the platform default. */
export function readCmUiMode(): CmUiMode {
  if (typeof window === 'undefined') return 'web';
  applyQueryOverride();
  return sessionMode ?? readStored() ?? cmDefaultUiMode();
}

/** Switch the UI (null = platform default); open pages re-render at once. */
export function setCmUiMode(mode: CmUiMode | null): void {
  writeStored(mode);
  sessionMode = mode;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useCmUiMode(): CmUiMode {
  return useSyncExternalStore(subscribe, readCmUiMode, () => 'web');
}

/** The mobile UI was forced in a browser (not the native default): the drawer then offers the way back. */
export function isCmUiModeForced(): boolean {
  return readCmUiMode() !== cmDefaultUiMode();
}
