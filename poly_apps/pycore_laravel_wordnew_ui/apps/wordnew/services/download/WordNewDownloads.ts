import { isNativeAppShell } from '../../../../core/network/NativeShell';
import {
  downloadBaseUrl as appDownloadBaseUrl,
  fetchAppDownloads,
  fetchAppManifest,
  fileUrl as appFileUrl,
  groupByPlatform,
  isAndroidAppShell,
  manifestUrl as appManifestUrl,
  type AppDownloadFile,
  type AppDownloadGroup,
  type AppDownloadManifest,
  type AppDownloadResult,
  type AppManifestOutcome,
} from '@/shared/app-update/AppDownloads';
import type { WfNewEndpoint, WfNewEndpointSnapshot } from '../../api/WfNewApiTypes';

export const WORDNEW_DOWNLOAD_APP = 'wordnew';

export type WordNewDownloadFile = AppDownloadFile;
export type WordNewDownloadManifest = AppDownloadManifest;
export type WordNewDownloadResult = AppDownloadResult;
export type CandidateOutcome = AppManifestOutcome;
export type WordNewDownloadGroup = AppDownloadGroup;
export { groupByPlatform, isAndroidAppShell };

export function endpointOrigin(endpoint: Pick<WfNewEndpoint, 'protocol' | 'url' | 'port'>): string {
  return `${endpoint.protocol}://${endpoint.url}${endpoint.port ? `:${endpoint.port}` : ''}`;
}

/** Page origin first (web served by FrankenPHP), then the selected Laravel endpoint, then the healthy others. */
export function downloadOrigins(snapshot: WfNewEndpointSnapshot): string[] {
  const origins: string[] = [];
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol) && !isNativeAppShell()) {
    origins.push(window.location.origin);
  }
  const selected = snapshot.endpoints.find((endpoint) => endpoint.id === snapshot.currentId);
  const others = snapshot.endpoints.filter((endpoint) => endpoint !== selected && snapshot.health[endpoint.id]?.isHealthy);
  for (const endpoint of [selected, ...others]) {
    if (endpoint) origins.push(endpointOrigin(endpoint));
  }
  return Array.from(new Set(origins));
}

export function downloadBaseUrl(origin: string): string {
  return appDownloadBaseUrl(origin, WORDNEW_DOWNLOAD_APP);
}

export function manifestUrl(origin: string): string {
  return appManifestUrl(origin, WORDNEW_DOWNLOAD_APP);
}

export function fileUrl(origin: string, file: string): string {
  return appFileUrl(origin, WORDNEW_DOWNLOAD_APP, file);
}

/** One origin's manifest: ok, missing (answered without one) or error (no answer). */
export function fetchCandidate(origin: string): Promise<CandidateOutcome> {
  return fetchAppManifest(origin, WORDNEW_DOWNLOAD_APP);
}

/** Probes every origin in parallel; the first manifest that lists a package wins. */
export function fetchDownloads(origins: string[]): Promise<WordNewDownloadResult> {
  return fetchAppDownloads(origins, WORDNEW_DOWNLOAD_APP);
}
