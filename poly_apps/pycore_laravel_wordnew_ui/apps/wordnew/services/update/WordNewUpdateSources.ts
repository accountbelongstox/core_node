/**
 * WordNew's update origins: the shared source order (shared/app-update/AppUpdateSources) with WordNew's mesh hosts -
 * the selected pycore host, the Laravel tailnet endpoints and the Laravel work-node roster.
 */
import {
  buildUpdateSourceGroups,
  machineHostOf,
  meshDomainOf,
  meshHostOrigins,
  selectedPycoreMeshHost,
  type AppUpdateSourceGroup,
} from '@/shared/app-update/AppUpdateSources';
import { tailnetDomainOf } from '../../../../core/contracts/MeshDomain';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreNodes, workNodeHost } from '../WordNewPycoreNodes';

export { publicOrigins } from '@/shared/app-update/AppUpdateSources';
export type WordNewUpdateSourceGroup = AppUpdateSourceGroup;

const NODE_HOST_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}$/;

function laravelMeshHosts(): string[] {
  const snapshot = wfNewEndpoints.getSnapshot();
  const selected = snapshot.endpoints.find((endpoint) => endpoint.id === snapshot.currentId);
  const rest = snapshot.endpoints.filter((endpoint) => endpoint !== selected);
  const healthyFirst = [...rest.filter((endpoint) => snapshot.health[endpoint.id]?.isHealthy), ...rest.filter((endpoint) => !snapshot.health[endpoint.id]?.isHealthy)];
  return [selected, ...healthyFirst]
    .filter((endpoint): endpoint is NonNullable<typeof endpoint> => !!endpoint && endpoint.protocol === 'https' && !!tailnetDomainOf(endpoint.url))
    .flatMap((endpoint) => [endpoint.url.toLowerCase(), machineHostOf(endpoint.url)]);
}

function rosterMeshHosts(domain: string): string[] {
  if (!domain) return [];
  return wordNewPycoreNodes.getSnapshot().nodes
    .map((node) => workNodeHost(node))
    .filter((host) => NODE_HOST_PATTERN.test(host))
    .map((host) => `${host}.${domain}`);
}

/** Mesh origins in priority order: selected pycore host, Laravel tailnet endpoints (API host, then machine host), roster hosts. */
export function meshOrigins(): string[] {
  const direct = [selectedPycoreMeshHost(), ...laravelMeshHosts()].filter(Boolean);
  return meshHostOrigins([...direct, ...rosterMeshHosts(meshDomainOf(direct))]);
}

export function updateSourceGroups(): WordNewUpdateSourceGroup[] {
  return buildUpdateSourceGroups(meshOrigins);
}
