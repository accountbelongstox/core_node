import { useSyncExternalStore } from 'react';
import { isPycoreRelayMode, subscribePycoreTarget } from '../../../core/integrations/pycore/pycoreTarget';
import { isPycoreRouteDirectOnly } from '../../../core/integrations/pycore/PycoreHttpRoutes';

/** True while the selected pycore is reached through the relay and the route is one the relay never carries. */
export function usePcDirectOnly(route: string): boolean {
  const relayed = useSyncExternalStore(subscribePycoreTarget, isPycoreRelayMode, () => false);
  return relayed && isPycoreRouteDirectOnly(route);
}
