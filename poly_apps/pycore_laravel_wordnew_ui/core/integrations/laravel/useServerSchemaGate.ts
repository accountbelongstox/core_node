import { useEffect, useSyncExternalStore } from 'react';
import { serverSchemaGate, type ServerSchemaSnapshot } from './ServerSchemaGate';

/** The selected Laravel server's schema state; the first mount probes /api/health once so `unknown` resolves. */
export function useServerSchemaGate(): ServerSchemaSnapshot {
  useEffect(() => {
    if (serverSchemaGate.getSnapshot().schema === 'unknown') void serverSchemaGate.probe();
  }, []);
  return useSyncExternalStore(serverSchemaGate.subscribe, serverSchemaGate.getSnapshot, serverSchemaGate.getSnapshot);
}
