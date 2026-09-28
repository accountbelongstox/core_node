import React, { useEffect, useRef, useState } from 'react';
import { pycoreManagerUiStateSync } from './PycoreManagerUiStateSync';

// First paint must never wait on the backend: the UI renders after a short
// grace period even while the state read is still in flight. When the late
// reconcile then reports remote changes, reload once so no screen keeps a
// stale state mix.
const GATE_GRACE_MS = 1200;

export const PcUiStateBackupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let active = true;
    const markReady = () => {
      if (!active || readyRef.current) return;
      readyRef.current = true;
      setReady(true);
    };
    const graceTimer = setTimeout(markReady, GATE_GRACE_MS);
    pycoreManagerUiStateSync.start();
    void pycoreManagerUiStateSync.initialize().then((changed) => {
      if (!active) return;
      clearTimeout(graceTimer);
      if (readyRef.current) {
        if (changed) window.location.reload();
        return;
      }
      markReady();
    });
    return () => {
      active = false;
      clearTimeout(graceTimer);
      pycoreManagerUiStateSync.stop();
    };
  }, []);

  if (!ready) {
    return <div className="h-full min-h-[160px] animate-pulse" aria-busy="true" />;
  }
  return <>{children}</>;
};

export default PcUiStateBackupGate;
