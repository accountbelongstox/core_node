/** Laravel API service of the API center, over the shared endpoint manager. */
import { endpointBaseUrl } from '../../../../core/integrations/laravel/LaravelEndpoints';
import { wfNewApi } from '../index';
import { isCurrentUrlId, wfNewEndpoints } from '../WfNewEndpoints';
import type { WfNewEndpointSnapshot } from '../WfNewApiTypes';
import type {
  WordNewApiDiagnosis,
  WordNewApiEntry,
  WordNewApiService,
  WordNewApiServiceSnapshot,
} from './WordNewApiServiceTypes';

let source: WfNewEndpointSnapshot | null = null;
let derived: WordNewApiServiceSnapshot | null = null;

function derive(snapshot: WfNewEndpointSnapshot): WordNewApiServiceSnapshot {
  const current = snapshot.endpoints.find((endpoint) => endpoint.id === snapshot.currentId);
  const entries = snapshot.endpoints.map((endpoint): WordNewApiEntry => {
    const health = snapshot.health[endpoint.id];
    return {
      id: endpoint.id,
      url: endpointBaseUrl(endpoint),
      label: endpoint.description || endpointBaseUrl(endpoint),
      kindKey: isCurrentUrlId(endpoint.id)
        ? 'apiCenter.kind.currentUrl'
        : endpoint.custom ? 'apiCenter.kind.custom' : 'apiCenter.kind.builtin',
      state: !health ? 'unknown' : health.isHealthy ? 'online' : 'offline',
      latencyMs: health?.isHealthy ? health.responseTime : null,
      detail: health && !health.isHealthy ? health.error ?? '' : '',
      selected: endpoint.id === snapshot.currentId,
      pinned: false,
      temporary: false,
      removable: endpoint.custom === true,
    };
  });
  const probed = Object.keys(snapshot.health).length > 0;
  return {
    state: snapshot.testing || !probed ? 'checking' : snapshot.healthy ? 'online' : 'offline',
    selectedUrl: current ? endpointBaseUrl(current) : '',
    pinned: false,
    temporary: false,
    entries,
    busy: snapshot.testing,
  };
}

export const wordNewLaravelApiService: WordNewApiService = {
  id: 'laravel',
  titleKey: 'apiCenter.laravel.title',
  descriptionKey: 'api.autoDesc',
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
  refresh: () => wfNewEndpoints.testAll(),
  select: async (entryId) => (await wfNewEndpoints.switchEndpoint(entryId)).ok,
  add: (input) => {
    const added = wfNewEndpoints.addCustomEndpoint({ url: input.trim() });
    if (added) void wfNewEndpoints.recheckAndFailover();
    return added !== '';
  },
  remove: (entryId) => {
    wfNewEndpoints.removeCustomEndpoint(entryId);
    void wfNewEndpoints.recheckAndFailover();
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
