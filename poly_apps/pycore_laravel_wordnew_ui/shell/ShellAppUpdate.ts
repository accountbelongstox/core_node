/**
 * App packages of the shell: the app id whose builds this UI offers and updates to, where to find them (mesh
 * origins of the selected pycore host and the Laravel tailnet endpoints, then the public origins), and the in-app
 * updater of a shell-mounted Android build (pycore-manager). Standalone flavors keep their own updater.
 */
import { AppUpdater } from '@/shared/app-update/AppUpdater';
import {
  buildUpdateSourceGroups,
  machineHostOf,
  meshHostOrigins,
  publicOrigins,
  selectedPycoreMeshHost,
  type AppUpdateSourceGroup,
} from '@/shared/app-update/AppUpdateSources';
import { tailnetDomainOf } from '../core/contracts/MeshDomain';
import { isNativeAppShell } from '../core/network/NativeShell';
import { apiManager } from '../core/integrations/laravel/ApiManager';
import type { BackendApiEndpoint } from '../core/integrations/laravel/LaravelEndpoints';
import { FLAVOR } from './flavor';
import { ShellStorageKeys } from './ShellStorageKeys';

/** The entry app every UI is reached from; the web shell offers its downloads. */
const SHELL_ENTRY_APP = 'pycore-manager';
const SHELL_MOUNT = 'shell';

/** The app whose packages this build offers: the shell-mounted flavor itself, else the entry app. */
export const SHELL_DOWNLOAD_APP = FLAVOR.mount === SHELL_MOUNT ? FLAVOR.id : SHELL_ENTRY_APP;

function endpointOrigin(endpoint: BackendApiEndpoint): string {
  return `${endpoint.protocol}://${endpoint.url}${endpoint.port ? `:${endpoint.port}` : ''}`;
}

function laravelEndpointsCurrentFirst(): BackendApiEndpoint[] {
  const current = apiManager.getCurrentEndpoint();
  const rest = apiManager.getAllEndpoints().filter((endpoint) => endpoint.id !== current?.id);
  return current ? [current, ...rest] : rest;
}

/**
 * Mesh origins: the Laravel tailnet endpoints (current first; their own API host serves the downloads, then the
 * machine host), then the selected pycore host.
 */
export function shellMeshOrigins(): string[] {
  const laravelHosts = laravelEndpointsCurrentFirst()
    .filter((endpoint) => endpoint.protocol === 'https' && !!tailnetDomainOf(endpoint.url))
    .flatMap((endpoint) => [endpoint.url.toLowerCase(), machineHostOf(endpoint.url)]);
  return meshHostOrigins([...laravelHosts, selectedPycoreMeshHost()]);
}

export function shellUpdateSourceGroups(): AppUpdateSourceGroup[] {
  return buildUpdateSourceGroups(shellMeshOrigins);
}

/** Download origins: this page (web), the Laravel endpoints (current first), the mesh hosts, the public origins. */
export function shellDownloadOrigins(): string[] {
  const origins: string[] = [];
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol) && !isNativeAppShell()) {
    origins.push(window.location.origin);
  }
  origins.push(...laravelEndpointsCurrentFirst().map(endpointOrigin), ...shellMeshOrigins(), ...publicOrigins());
  return Array.from(new Set(origins));
}

/** The updater of a shell-mounted Android build; null in standalone flavors (they own their updater). */
export const shellAppUpdater: AppUpdater | null = FLAVOR.mount === SHELL_MOUNT
  ? new AppUpdater({
    app: SHELL_DOWNLOAD_APP,
    sourceGroups: shellUpdateSourceGroups,
    dismissedKey: ShellStorageKeys.APP_UPDATE_DISMISSED_CODE,
    checkedAtKey: ShellStorageKeys.APP_UPDATE_CHECKED_AT,
  })
  : null;
