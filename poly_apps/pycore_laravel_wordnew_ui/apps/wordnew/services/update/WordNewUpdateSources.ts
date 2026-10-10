/**
 * Where the app looks for a newer build (contract app_downloads.auto_update): mesh origins first - the headscale
 * (*.mesh.*) hosts the app already knows (selected pycore host, Laravel tailnet endpoints, Laravel work-node
 * roster) - then the public origins.
 */
import { APP_AUTO_UPDATE, TAILNET_API_LABEL } from '../../../../core/contracts/ServiceContract';
import { meshDomain, tailnetDomainOf } from '../../../../core/contracts/MeshDomain';
import { getPycoreTarget } from '../../../../core/integrations/pycore';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreNodes, workNodeHost } from '../WordNewPycoreNodes';

const MESH_SOURCE = 'mesh';
const PUBLIC_SOURCE = 'public';
const NODE_HOST_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}$/;

export interface WordNewUpdateSourceGroup {
  kind: string;
  origins: string[];
}

function machineHostOf(host: string): string {
  const lower = host.trim().toLowerCase().replace(/\.$/, '');
  return lower.startsWith(`${TAILNET_API_LABEL}.`) ? lower.slice(TAILNET_API_LABEL.length + 1) : lower;
}

function selectedPycoreMeshHost(): string {
  try {
    const host = new URL(getPycoreTarget().url).hostname;
    return tailnetDomainOf(host) ? machineHostOf(host) : '';
  } catch {
    return '';
  }
}

function laravelMeshHosts(): string[] {
  const snapshot = wfNewEndpoints.getSnapshot();
  const selected = snapshot.endpoints.find((endpoint) => endpoint.id === snapshot.currentId);
  const rest = snapshot.endpoints.filter((endpoint) => endpoint !== selected);
  const healthyFirst = [...rest.filter((endpoint) => snapshot.health[endpoint.id]?.isHealthy), ...rest.filter((endpoint) => !snapshot.health[endpoint.id]?.isHealthy)];
  return [selected, ...healthyFirst]
    .filter((endpoint): endpoint is NonNullable<typeof endpoint> => !!endpoint && endpoint.protocol === 'https' && !!tailnetDomainOf(endpoint.url))
    .map((endpoint) => machineHostOf(endpoint.url));
}

function rosterMeshHosts(domain: string): string[] {
  if (!domain) return [];
  return wordNewPycoreNodes.getSnapshot().nodes
    .map((node) => workNodeHost(node))
    .filter((host) => NODE_HOST_PATTERN.test(host))
    .map((host) => `${host}.${domain}`);
}

/** Mesh origins in priority order: selected pycore host, Laravel tailnet endpoints, roster hosts. */
export function meshOrigins(): string[] {
  const direct = [selectedPycoreMeshHost(), ...laravelMeshHosts()].filter(Boolean);
  const domain = tailnetDomainOf(direct[0] ?? '') || meshDomain();
  const hosts = [...direct, ...rosterMeshHosts(domain)];
  return Array.from(new Set(hosts)).map((host) => `https://${host}`);
}

export function publicOrigins(): string[] {
  return Array.from(new Set(APP_AUTO_UPDATE.publicBaseUrls.map((url) => url.replace(/\/+$/, ''))));
}

/** The source groups in contract order; a group is tried only after the previous one gave no manifest. */
export function updateSourceGroups(): WordNewUpdateSourceGroup[] {
  const groups: WordNewUpdateSourceGroup[] = [];
  const seen = new Set<string>();
  for (const kind of APP_AUTO_UPDATE.sourceOrder) {
    const origins = (kind === MESH_SOURCE ? meshOrigins() : kind === PUBLIC_SOURCE ? publicOrigins() : [])
      .filter((origin) => !seen.has(origin));
    origins.forEach((origin) => seen.add(origin));
    if (origins.length) groups.push({ kind, origins });
  }
  return groups;
}
