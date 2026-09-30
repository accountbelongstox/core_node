/**
 * PcTestPopupContext - global provider for the unified test popup.
 *
 * Mounted ONCE in PcLayout so any pycore page can call `usePcTestPopup().openTest(...)`
 * with a hub entry (or an entry key / id resolved through the shared catalog store).
 * The popup itself is rendered here when a test is open.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { aiHubEntryKey, findAiHubEntry, getAiHubCatalogState } from '@/apps/pycore-manager/api';
import type { AiHubEntry } from '@/apps/pycore-manager/api';
import { PcTestPopup } from './ai/test/PcTestPopup';

export type PcTestTarget = AiHubEntry | string;

interface PcTestPopupContextValue {
  /** Open the test window for one hub entry, or for an entry key / id of the loaded catalog. */
  openTest: (target: PcTestTarget, category?: string) => void;
  closeTest: () => void;
}

const PcTestPopupContext = createContext<PcTestPopupContextValue | null>(null);

export const PcTestPopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entry, setEntry] = useState<AiHubEntry | null>(null);
  const openTest = useCallback((target: PcTestTarget, category?: string) => {
    const resolved = typeof target === 'string'
      ? findAiHubEntry(getAiHubCatalogState().categories, target, category)
      : target;
    if (resolved) setEntry(resolved);
  }, []);
  const closeTest = useCallback(() => setEntry(null), []);
  return (
    <PcTestPopupContext.Provider value={{ openTest, closeTest }}>
      {children}
      {entry && <PcTestPopup key={aiHubEntryKey(entry)} entry={entry} onClose={closeTest} />}
    </PcTestPopupContext.Provider>
  );
};

const NOOP_CONTEXT: PcTestPopupContextValue = {
  openTest: () => { /* provider missing — degrade to no-op instead of crashing the tree */ },
  closeTest: () => { /* provider missing */ },
};

let missingProviderWarned = false;

export function usePcTestPopup(): PcTestPopupContextValue {
  const ctx = useContext(PcTestPopupContext);
  if (!ctx) {
    // A missing provider must not crash the whole panel tree; warn once and degrade.
    if (!missingProviderWarned && typeof console !== 'undefined') {
      missingProviderWarned = true;
      console.warn('[PcTestPopup] used outside PcTestPopupProvider — test popup disabled');
    }
    return NOOP_CONTEXT;
  }
  return ctx;
}

export default PcTestPopupProvider;
