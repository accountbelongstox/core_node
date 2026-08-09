import React, { useEffect, useState } from 'react';
import { pycoreManagerUiStateSync } from './PycoreManagerUiStateSync';

export const PcUiStateBackupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void pycoreManagerUiStateSync.initialize().finally(() => {
      if (!active) return;
      pycoreManagerUiStateSync.start();
      setReady(true);
    });
    return () => {
      active = false;
      pycoreManagerUiStateSync.stop();
    };
  }, []);

  if (!ready) {
    return <div className="h-full min-h-[160px] animate-pulse" aria-busy="true" />;
  }
  return <>{children}</>;
};

export default PcUiStateBackupGate;
