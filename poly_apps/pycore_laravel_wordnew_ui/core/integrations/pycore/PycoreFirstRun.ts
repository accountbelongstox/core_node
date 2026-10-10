/**
 * PycoreFirstRun - the one-time choice of the pycore selection, shared by every UI app.
 *
 * Selection never switches by itself: only when nothing is persisted yet does the first run
 * pick an entry, and only one that answers now - a reachable GPU work node, then a CPU work
 * node, then the fastest reachable entry; the relay entry only while a relay machine is
 * paired. Candidates come from the live tailnet list (refreshed first), never from a static
 * entry alone. Nothing reachable: nothing is stored and the caller tries again later.
 */
import { laravelApi } from '../laravel/LaravelAPI';
import {
  getPycoreSelectedTarget,
  getPycoreTarget,
  listPycoreEndpoints,
  rememberPycoreLanUrls,
  setPycoreTarget,
  type PycoreEndpoint,
} from './pycoreTarget';
import { getPycoreProbe, probePycoreEndpoints, type PycoreProbeResult } from './PycoreEndpointProbe';
import { refreshTailnetPeers } from '../../network/TailnetDiscovery';
import { laravelRelayDeviceId } from './RelayPairing';
import { pycoreLink } from './PycoreServiceLink';

/** compute_class of a GPU work node (Laravel PycoreComputeRoster). */
export const PYCORE_GPU_COMPUTE_CLASS = 'gpu';

const PROBE_TIMEOUT_MS = 4_000;
/** The first-run choice waits at most this long for Laravel's online work-node roster. */
const WORK_NODE_ROSTER_TIMEOUT_MS = 4_000;
/** First-run rank of a reachable entry: a GPU work node, a CPU work node, any other pycore. */
const RANK_GPU_NODE = 0;
const RANK_CPU_NODE = 1;
const RANK_OTHER = 2;

export interface PycoreWorkNodeRoster {
  /** First-run rank per host label: a GPU node, a CPU node. */
  ranks: Map<string, number>;
  /** LAN URLs per host label: the online nodes' reports over the last remembered ones. */
  lanUrls: Map<string, string[]>;
}

export interface PycoreRankedEndpoint extends PycoreEndpoint {
  probe: PycoreProbeResult | null;
}

export interface PycoreFirstRunOptions {
  /** A roster the caller already read (else it is read here). */
  roster?: PycoreWorkNodeRoster;
  /** False when the caller just probed the candidates. */
  probe?: boolean;
  /** Checked before storing; false abandons the choice (a newer user choice was made). */
  isCurrent?: () => boolean;
  /** Reload the page when the stored choice differs from the target in effect (clients that read it once at start). */
  reload?: boolean;
}

/** First DNS label of an entry's host, lower case ('' when not a URL). */
export function pycoreHostKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().split('.')[0];
  } catch {
    return '';
  }
}

/**
 * Laravel's online work nodes by the host label pycore claims with: the machines that generate
 * and the LAN URLs they serve. Empty ranks when Laravel does not answer in time (or needs a login).
 */
export async function readPycoreWorkNodeRoster(): Promise<PycoreWorkNodeRoster> {
  const roster: PycoreWorkNodeRoster = { ranks: new Map(), lanUrls: new Map() };
  try {
    const response = await Promise.race([
      laravelApi.getWorkNodes(true),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WORK_NODE_ROSTER_TIMEOUT_MS)),
    ]);
    for (const node of response?.nodes ?? []) {
      const host = String(node.label ?? '').toLowerCase().split('.')[0];
      if (!node.online || !host) continue;
      const rank = node.compute_class === PYCORE_GPU_COMPUTE_CLASS ? RANK_GPU_NODE : RANK_CPU_NODE;
      roster.ranks.set(host, Math.min(rank, roster.ranks.get(host) ?? rank));
      const lan = (node.lan_urls ?? []).filter((url) => typeof url === 'string' && url !== '');
      if (lan.length > 0) roster.lanUrls.set(host, [...new Set([...(roster.lanUrls.get(host) ?? []), ...lan])]);
    }
  } catch {
    // No roster: the remembered LAN URLs only, and the first run falls back to the fastest reachable entry.
  }
  roster.lanUrls = rememberPycoreLanUrls(roster.lanUrls);
  return roster;
}

/** Reachable first (fastest first); otherwise the list's own preference order. */
export function orderPycoreEndpoints(endpoints: PycoreEndpoint[]): PycoreRankedEndpoint[] {
  return endpoints
    .map((endpoint, index) => ({ endpoint: { ...endpoint, probe: getPycoreProbe(endpoint.url) }, index }))
    .sort((left, right) => {
      const leftUp = left.endpoint.probe?.state === 'up';
      const rightUp = right.endpoint.probe?.state === 'up';
      if (leftUp !== rightUp) return leftUp ? -1 : 1;
      if (leftUp && rightUp) return (left.endpoint.probe?.ms ?? Infinity) - (right.endpoint.probe?.ms ?? Infinity);
      return left.index - right.index;
    })
    .map(({ endpoint }) => endpoint);
}

/**
 * The persisted selection, choosing and storing one first when none exists yet.
 * Resolves with the selected URL, or '' while nothing answers.
 */
export async function choosePycoreFirstRunTarget(options: PycoreFirstRunOptions = {}): Promise<string> {
  const stored = getPycoreSelectedTarget()?.url;
  if (stored) return stored;
  const [roster] = await Promise.all([
    options.roster ? Promise.resolve(options.roster) : readPycoreWorkNodeRoster(),
    options.probe === false ? Promise.resolve(null) : refreshTailnetPeers(),
  ]);
  const endpoints = listPycoreEndpoints().filter((endpoint) => endpoint.source !== 'lan');
  if (options.probe !== false) {
    await probePycoreEndpoints(endpoints.filter((endpoint) => endpoint.kind !== 'relay'), PROBE_TIMEOUT_MS);
  }
  const reachable = orderPycoreEndpoints(endpoints)
    .filter((endpoint) => endpoint.probe?.state === 'up')
    .map((endpoint, index) => ({ endpoint, index, rank: roster.ranks.get(pycoreHostKey(endpoint.url)) ?? RANK_OTHER }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)[0]?.endpoint;
  const relay = laravelRelayDeviceId() !== null ? endpoints.find((endpoint) => endpoint.kind === 'relay') : undefined;
  const first = reachable ?? relay;
  if (!first || (options.isCurrent && !options.isCurrent()) || getPycoreSelectedTarget()) {
    return getPycoreSelectedTarget()?.url ?? '';
  }
  const reload = options.reload === true && first.url !== getPycoreTarget().url;
  if (!setPycoreTarget(first.url, { reload })) return '';
  pycoreLink.retarget();
  return first.url;
}
