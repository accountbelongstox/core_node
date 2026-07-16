/**
 * PcTestPopupContext - global provider for the unified test popup.
 *
 * Mounted ONCE in PcLayout so any pycore page can call `usePcTestPopup().openTest(...)`
 * to pop up the floating test window (TTS / STT / AI / OCR). The popup itself is
 * rendered here when a test is open; nothing else needs to mount it.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { PcTestPopup, type PcTestKind, type PcTestPopupState } from './PcTestPopup';

type PcTestDefaults = NonNullable<PcTestPopupState['defaults']>;

interface PcTestPopupContextValue {
  /** Open the floating test window for one engine/provider. */
  openTest: (kind: PcTestKind, target: string, defaults?: PcTestDefaults) => void;
  closeTest: () => void;
}

const PcTestPopupContext = createContext<PcTestPopupContextValue | null>(null);

export const PcTestPopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PcTestPopupState | null>(null);
  const openTest = useCallback(
    (kind: PcTestKind, target: string, defaults?: PcTestDefaults) => setState({ kind, target, defaults }),
    [],
  );
  const closeTest = useCallback(() => setState(null), []);
  return (
    <PcTestPopupContext.Provider value={{ openTest, closeTest }}>
      {children}
      {state && (
        <PcTestPopup
          key={`${state.kind}:${state.target}`}
          state={state}
          onClose={closeTest}
        />
      )}
    </PcTestPopupContext.Provider>
  );
};

export function usePcTestPopup(): PcTestPopupContextValue {
  const ctx = useContext(PcTestPopupContext);
  if (!ctx) throw new Error('usePcTestPopup must be used within a PcTestPopupProvider');
  return ctx;
}

export default PcTestPopupProvider;
