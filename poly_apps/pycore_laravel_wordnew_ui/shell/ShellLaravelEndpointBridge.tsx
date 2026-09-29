import { useEffect } from 'react';
import { apiManager } from '../core/integrations/laravel/ApiManager';
import {
  setSharedBaseURLPersistence,
  type SharedBaseURLPersistence,
} from '../core/integrations/laravel/transport/BaseAPI';
import { pycoreApiLocal } from '../core/integrations/pycore/PycoreApiLocal';
import { getPycoreHealth, PYCORE_HEALTH_EVENT } from '../core/integrations/pycore/PycoreHealth';

let synchronizedBaseURL = '';
let pendingBaseURL = '';
let synchronizationQueue: Promise<boolean> = Promise.resolve(true);

const persistLaravelEndpoint: SharedBaseURLPersistence = (baseURL) => {
  synchronizationQueue = synchronizationQueue
    .then(async () => {
      if (baseURL === synchronizedBaseURL) return true;
      const response = await pycoreApiLocal.bindLaravelWorkerEndpoint(baseURL) as {
        success?: boolean;
      } | null;
      return response?.success === true;
    })
    .then((success) => success, () => false)
    .then((success) => {
      if (success) synchronizedBaseURL = baseURL;
      pendingBaseURL = success ? '' : baseURL;
      return success;
    });
  return synchronizationQueue;
};

export const ShellLaravelEndpointBridge = (): null => {
  useEffect(() => {
    const retryPendingBinding = (): void => {
      if (pendingBaseURL && getPycoreHealth().up === true) void persistLaravelEndpoint(pendingBaseURL);
    };
    setSharedBaseURLPersistence(persistLaravelEndpoint);
    apiManager.preselectEndpointSync();
    window.addEventListener(PYCORE_HEALTH_EVENT, retryPendingBinding);
    return () => {
      window.removeEventListener(PYCORE_HEALTH_EVENT, retryPendingBinding);
      setSharedBaseURLPersistence(null);
    };
  }, []);

  return null;
};

export default ShellLaravelEndpointBridge;
