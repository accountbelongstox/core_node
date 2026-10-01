/** pycore API service of the API center, over the wordnew pycore link. */
import {
  probePycoreEndpoint,
  pycoreApi,
  type PycoreProbeResult,
} from '../../../../core/integrations/pycore';
import {
  wordNewPycoreLink,
  type WordNewPycoreLinkSnapshot,
  type WordNewPycoreLinkState,
} from '../../integrations/WordNewPycoreLink';
import type {
  WordNewApiDiagnosis,
  WordNewApiEntryState,
  WordNewApiService,
  WordNewApiServiceSnapshot,
  WordNewApiServiceState,
} from './WordNewApiServiceTypes';

/** A word every English cache is likely to hold: exercises the lookup route end to end. */
const DIAGNOSE_WORD = { kind: 'word' as const, language: 'en', text: 'hello' };
const DIAGNOSE_TIMEOUT_MS = 4_000;

const PROBE_STATES: Record<PycoreProbeResult['state'], WordNewApiEntryState> = {
  probing: 'checking',
  up: 'online',
  down: 'offline',
  rejected: 'refused',
  no_route: 'refused',
  relay: 'relay',
};

const SERVICE_STATES: Record<WordNewPycoreLinkState, WordNewApiServiceState> = {
  idle: 'checking',
  probing: 'checking',
  online: 'online',
  reconnecting: 'reconnecting',
  offline: 'offline',
};

let source: WordNewPycoreLinkSnapshot | null = null;
let derived: WordNewApiServiceSnapshot | null = null;

function derive(snapshot: WordNewPycoreLinkSnapshot): WordNewApiServiceSnapshot {
  return {
    state: SERVICE_STATES[snapshot.state],
    selectedUrl: snapshot.selectedUrl,
    temporary: snapshot.temporaryUrl !== '',
    busy: snapshot.state === 'probing',
    entries: snapshot.candidates.map((candidate) => ({
      id: candidate.url,
      url: candidate.url,
      label: candidate.label,
      kindKey: `apiCenter.kind.${candidate.kind}`,
      state: candidate.probe ? PROBE_STATES[candidate.probe.state] : 'unknown',
      latencyMs: candidate.probe?.state === 'up' ? candidate.probe.ms : null,
      detail: candidate.probe && candidate.probe.httpStatus && candidate.probe.state !== 'up'
        ? `HTTP ${candidate.probe.httpStatus}`
        : '',
      selected: candidate.url === snapshot.selectedUrl,
      temporary: candidate.url === snapshot.temporaryUrl,
      removable: candidate.source === 'recent',
    })),
  };
}

export const wordNewPycoreApiService: WordNewApiService = {
  id: 'pycore',
  titleKey: 'apiCenter.pycore.title',
  descriptionKey: 'apiCenter.pycore.description',
  addPlaceholderKey: 'apiCenter.pycore.addPlaceholder',
  diagnoseHintKey: 'apiCenter.pycore.diagnoseHint',
  subscribe: wordNewPycoreLink.subscribe,
  getSnapshot: () => {
    const snapshot = wordNewPycoreLink.getSnapshot();
    if (snapshot !== source || !derived) {
      source = snapshot;
      derived = derive(snapshot);
    }
    return derived;
  },
  start: () => { void wordNewPycoreLink.ensure(); },
  refresh: async () => (await wordNewPycoreLink.refresh()).state === 'online',
  select: (entryId) => wordNewPycoreLink.choose(entryId),
  add: (input) => wordNewPycoreLink.add(input),
  remove: (entryId) => wordNewPycoreLink.remove(entryId),
  clearTemporary: () => wordNewPycoreLink.clearTemporary(),
  diagnose: async (): Promise<WordNewApiDiagnosis> => {
    const { selectedUrl, candidates } = await wordNewPycoreLink.ensure();
    const selected = candidates.find((candidate) => candidate.url === selectedUrl);
    if (!selected) return { ok: false, messageKey: 'apiCenter.pycore.diagnoseNoEntry', params: {} };
    const probe = selected.kind === 'relay' ? null : await probePycoreEndpoint(selected, DIAGNOSE_TIMEOUT_MS);
    if (probe && probe.state !== 'up') {
      return { ok: false, messageKey: 'apiCenter.pycore.diagnoseOffline', params: { state: probe.state } };
    }
    const started = performance.now();
    const answer = await pycoreApi.orchResourceLookup([DIAGNOSE_WORD]).catch((error: unknown) => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      items: undefined,
    }));
    const ms = Math.round(performance.now() - started);
    if (!answer.success || !answer.items?.[0]) {
      return { ok: false, messageKey: 'apiCenter.pycore.diagnoseCallFailed', params: { ms, msg: answer.error ?? '' } };
    }
    const item = answer.items[0];
    return {
      ok: true,
      messageKey: item.hit ? 'apiCenter.pycore.diagnoseHit' : 'apiCenter.pycore.diagnoseMiss',
      params: { ms, host: probe?.hostname || selected.label, meaning: item.meaning || '-' },
    };
  },
};
