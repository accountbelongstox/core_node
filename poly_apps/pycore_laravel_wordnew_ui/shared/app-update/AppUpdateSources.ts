/**
 * Where an app looks for a newer build (contract app_downloads.auto_update): mesh origins first - headscale
 * (*.mesh.*) hosts the app already knows - then the public origins. Each app supplies its own mesh hosts.
 */
import { APP_AUTO_UPDATE, TAILNET_API_LABEL } from '../../core/contracts/ServiceContract';
import { meshDomain, tailnetDomainOf } from '../../core/contracts/MeshDomain';
import { getPycoreTarget } from '../../core/integrations/pycore';

const MESH_SOURCE = 'mesh';
const PUBLIC_SOURCE = 'public';

export interface AppUpdateSourceGroup {
  kind: string;
  origins: string[];
}

/** The machine host of a mesh host (the `api.` label of tailnet API endpoints dropped). */
export function machineHostOf(host: string): string {
  const lower = host.trim().toLowerCase().replace(/\.$/, '');
  return lower.startsWith(`${TAILNET_API_LABEL}.`) ? lower.slice(TAILNET_API_LABEL.length + 1) : lower;
}

/** The selected pycore host when it is a mesh host, else ''. */
export function selectedPycoreMeshHost(): string {
  try {
    const host = new URL(getPycoreTarget().url).hostname;
    return tailnetDomainOf(host) ? machineHostOf(host) : '';
  } catch {
    return '';
  }
}

/** The mesh domain of the first known host, else the configured one. */
export function meshDomainOf(hosts: string[]): string {
  return tailnetDomainOf(hosts[0] ?? '') || meshDomain();
}

export function meshHostOrigins(hosts: string[]): string[] {
  return Array.from(new Set(hosts.filter(Boolean))).map((host) => `https://${host}`);
}

export function publicOrigins(): string[] {
  return Array.from(new Set(APP_AUTO_UPDATE.publicBaseUrls.map((url) => url.replace(/\/+$/, ''))));
}

/** The source groups in contract order; a group is tried only after the previous one gave no manifest. */
export function buildUpdateSourceGroups(meshOrigins: () => string[]): AppUpdateSourceGroup[] {
  const groups: AppUpdateSourceGroup[] = [];
  const seen = new Set<string>();
  for (const kind of APP_AUTO_UPDATE.sourceOrder) {
    const origins = (kind === MESH_SOURCE ? meshOrigins() : kind === PUBLIC_SOURCE ? publicOrigins() : [])
      .filter((origin) => !seen.has(origin));
    origins.forEach((origin) => seen.add(origin));
    if (origins.length) groups.push({ kind, origins });
  }
  return groups;
}
