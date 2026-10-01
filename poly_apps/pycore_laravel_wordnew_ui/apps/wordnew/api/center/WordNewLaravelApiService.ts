/** Laravel API service of the API center, over the shared endpoint manager. */
import { endpointBaseUrl } from '../../../../core/integrations/laravel/LaravelEndpoints';
import { wfNewApi } from '../index';
import { wfNewEndpoints } from '../WfNewEndpoints';
import type { WfNewEndpointSnapshot } from '../WfNewApiTypes';
import type {
  WordNewApiDiagnosis,
  WordNewApiEntry,
  WordNewApiService,
  WordNewApiServiceSnapshot,
  WordNewApiServiceState,
} from './WordNewApiServiceTypes';

let source: WfNewEndpointSnapshot | null = null;
let derived: WordNewApiServiceSnapshot | null = null;

function serviceState(snapshot: WfNewEndpointSnapshot): WordNewApiServiceState {
  if (snapshot.link === 'reconnecting') return 'reconnecting';
  if (snapshot.healthy || snapshot.link === 'online') return 'online';
  const probed = snapshot.currentId !== null && snapshot.health[snapshot.currentId] !== undefined;
  return snapshot.testing || !probed ? 'checking' : 'offline';
}

function derive(snapshot: WfNewEndpointSnapshot): WordNewApiServiceSnapshot {
  const current = snapshot.endpoints.find((endpoint) => endpoint.id === snapshot.currentId);
  const entries = snapshot.endpoints.map((endpoint): WordNewApiEntry => {
    const health = snapshot.health[endpoint.id];
    return {
      id: endpoint.id,
      url: endpointBaseUrl(endpoint),
      label: endpoint.description || endpointBaseUrl(endpoint),
      kindKey: `apiCenter.kind.${endpoint.kind}`,
      state: !health ? 'unknown' : health.isHealthy ? 'online' : 'offline',
      latencyMs: health?.isHealthy ? health.responseTime : null,
      detail: health && !health.isHealthy ? health.error ?? '' : '',
      selected: endpoint.id === snapshot.currentId,
      temporary: false,
      removable: endpoint.custom === true,
    };
  });
  return {
    state: serviceState(snapshot),
    selectedUrl: current ? endpointBaseUrl(current) : '',
    temporary: false,
    entries,
    busy: snapshot.testing,
  };
}

export const wordNewLaravelApiService: WordNewApiService = {
  id: 'laravel',
  titleKey: 'apiCenter.laravel.title',
  descriptionKey: 'apiCenter.laravel.description',
  addPlaceholderKey: 'apiCenter.laravel.addPlaceholder',
  diagnoseHintKey: 'api.probeHint',
  subscribe: wfNewEndpoints.subscribe,
  getSnapshot: () => {
    const snapshot = wfNewEndpoints.getSnapshot();
    if (snapshot !== source || !derived) {
      source = snapshot;
      derived = derive(snapshot);
    }
    return derived;
  },
  start: () => { void wfNewEndpoints.initialize(); },
  refresh: () => wfNewEndpoints.detect(),
  select: async (entryId) => (await wfNewEndpoints.switchEndpoint(entryId)).ok,
  add: (input) => {
    const added = wfNewEndpoints.addCustomEndpoint({ url: input.trim() });
    if (added) void wfNewEndpoints.detect();
    return added !== '';
  },
  remove: (entryId) => {
    wfNewEndpoints.removeCustomEndpoint(entryId);
  },
  diagnose: async (): Promise<WordNewApiDiagnosis> => {
    const endpoint = wfNewEndpoints.getCurrentEndpoint();
    if (!endpoint) return { ok: false, messageKey: 'api.probeNoEp', params: {} };
    const health = await wfNewEndpoints.checkEndpoint(endpoint);
    if (!health.isHealthy) {
      return { ok: false, messageKey: 'api.probeOffline', params: { err: health.error ?? '', ms: health.responseTime } };
    }
    return wfNewApi.getWordGroups()
      .then((groups) => ({ ok: true, messageKey: 'api.probeOk', params: { ms: health.responseTime, n: groups.length } }))
      .catch((error: unknown) => ({
        ok: false,
        messageKey: 'api.probeDataFail',
        params: { ms: health.responseTime, msg: error instanceof Error ? error.message : String(error) },
      }));
  },
};
