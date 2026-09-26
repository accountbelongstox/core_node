import { useEffect } from 'react';
import { apiManager } from '../core/integrations/laravel/ApiManager';
import {
  persistSharedBaseURL,
  setSharedBaseURLPersistence,
  type SharedBaseURLPersistence,
} from '../core/integrations/laravel/transport/BaseAPI';
import { pycoreApiLocal } from '../core/integrations/pycore/PycoreApiLocal';
import { getPycoreHealth, PYCORE_HEALTH_EVENT } from '../core/integrations/pycore/PycoreHealth';

let synchronizedBaseURL = '';
let synchronizationQueue: Promise<boolean> = Promise.resolve(true);

const persistLaravelEndpoint: SharedBaseURLPersistence = (baseURL) => {
  synchronizationQueue = synchronizationQueue
    .then(async () => {
      if (baseURL === synchronizedBaseURL) return true;
      const response = await pycoreApiLocal.bindLaravelWorkerEndpoint(baseURL) as {
        success?: boolean;
      } | null;
      const success = response?.success === true;
      if (success) synchronizedBaseURL = baseURL;
      return success;
    })
    .then((success) => success, () => false);
  return synchronizationQueue;
};

export const ShellLaravelEndpointBridge = (): null => {
  useEffect(() => {
    const synchronizeWhenReachable = (): void => {
      if (getPycoreHealth().up === true) void persistSharedBaseURL();
    };
    setSharedBaseURLPersistence(persistLaravelEndpoint);
    apiManager.preselectEndpointSync();
    void persistSharedBaseURL();
    window.addEventListener(PYCORE_HEALTH_EVENT, synchronizeWhenReachable);
    return () => {
      window.removeEventListener(PYCORE_HEALTH_EVENT, synchronizeWhenReachable);
      setSharedBaseURLPersistence(null);
    };
  }, []);

  return null;
};

export default ShellLaravelEndpointBridge;
