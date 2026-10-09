import { APP_DOWNLOADS } from '../../../../core/contracts/ServiceContract';
import { protocolFetch } from '../../../../core/network/ProtocolFetch';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { isDesktopAppShell } from '../../../../core/network/DesktopShell';
import { FLAVOR_REGISTRY } from '../../../../shell/flavor';
import type { WfNewEndpoint, WfNewEndpointSnapshot } from '../../api/WfNewApiTypes';

export const WORDNEW_DOWNLOAD_APP = 'wordnew';
const MANIFEST_TIMEOUT_MS = 8000;
const VERSION_SEPARATOR = /[.\-+]/;
const PLATFORM_ORDER = ['android', 'windows', 'linux'] as const;
const ANDROID_PLATFORM = 'android';

export interface WordNewDownloadFile {
  platform: string;
  build_type: string;
  version: string;
  file: string;
  latest: string;
  size: number;
  sha256: string;
  built_at: string;
}

export interface WordNewDownloadManifest {
  app: string;
  name: string;
  files: WordNewDownloadFile[];
  updated_at: string;
}

export type WordNewDownloadResult =
  | { state: 'ready'; origin: string; manifest: WordNewDownloadManifest }
  | { state: 'notPublished' }
  | { state: 'unreachable' };

type CandidateOutcome =
  | { kind: 'ok'; origin: string; manifest: WordNewDownloadManifest }
  | { kind: 'missing' }
  | { kind: 'error' };

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
  return `${origin}${APP_DOWNLOADS.urlPrefix}${WORDNEW_DOWNLOAD_APP}/`;
}

export function manifestUrl(origin: string): string {
  return `${downloadBaseUrl(origin)}${APP_DOWNLOADS.manifestFile}`;
}

export function fileUrl(origin: string, file: string): string {
  return `${downloadBaseUrl(origin)}${encodeURIComponent(file)}`;
}

function parseManifest(value: unknown): WordNewDownloadManifest | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WordNewDownloadManifest>;
  if (!Array.isArray(record.files)) return null;
  const files = record.files.filter((entry): entry is WordNewDownloadFile => (
    !!entry && typeof entry.file === 'string' && typeof entry.platform === 'string' && typeof entry.version === 'string'
  ));
  return {
    app: String(record.app ?? WORDNEW_DOWNLOAD_APP),
    name: String(record.name ?? WORDNEW_DOWNLOAD_APP),
    files,
    updated_at: String(record.updated_at ?? ''),
  };
}

async function fetchCandidate(origin: string): Promise<CandidateOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await protocolFetch(manifestUrl(origin), { cache: 'no-store', signal: controller.signal });
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const manifest = parseManifest(await response.json().catch(() => null));
    return manifest ? { kind: 'ok', origin, manifest } : { kind: 'missing' };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** Probes every origin in parallel; the first manifest that lists a package wins. */
export function fetchDownloads(origins: string[]): Promise<WordNewDownloadResult> {
  return new Promise((resolve) => {
    let pending = origins.length;
    let missing = false;
    let settled = false;
    const finish = (result: WordNewDownloadResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    if (!pending) {
      finish({ state: 'unreachable' });
      return;
    }
    for (const origin of origins) {
      void fetchCandidate(origin).then((outcome) => {
        pending -= 1;
        if (outcome.kind === 'ok' && outcome.manifest.files.length) {
          finish({ state: 'ready', origin: outcome.origin, manifest: outcome.manifest });
        } else if (outcome.kind !== 'error') {
          missing = true;
        }
        if (!pending) finish({ state: missing ? 'notPublished' : 'unreachable' });
      });
    }
  });
}

/** -1 / 0 / 1 comparing dotted numeric versions segment by segment (non-numeric segments compare as 0). */
export function compareVersions(left: string, right: string): number {
  const a = left.split(VERSION_SEPARATOR).map((part) => parseInt(part, 10) || 0);
  const b = right.split(VERSION_SEPARATOR).map((part) => parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function installedVersion(): string {
  return FLAVOR_REGISTRY[WORDNEW_DOWNLOAD_APP]?.version ?? '';
}

/** The Android app shell (the only shell an APK update applies to). */
export function isAndroidAppShell(): boolean {
  return isNativeAppShell() && !isDesktopAppShell();
}

export interface WordNewDownloadGroup {
  platform: string;
  latest: WordNewDownloadFile[];
  older: WordNewDownloadFile[];
}

function newestFirst(files: WordNewDownloadFile[]): WordNewDownloadFile[] {
  return [...files].sort((left, right) => right.built_at.localeCompare(left.built_at));
}

/** Per platform: the newest package of each build type, and the older ones. */
export function groupByPlatform(manifest: WordNewDownloadManifest): WordNewDownloadGroup[] {
  const ordered = [...PLATFORM_ORDER, ...manifest.files.map((entry) => entry.platform)];
  const platforms = Array.from(new Set(ordered)).filter((platform) => manifest.files.some((entry) => entry.platform === platform));
  const detected = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? ANDROID_PLATFORM : '';
  platforms.sort((left, right) => Number(right === detected) - Number(left === detected));
  return platforms.map((platform) => {
    const entries = newestFirst(manifest.files.filter((entry) => entry.platform === platform));
    const seen = new Set<string>();
    const latest: WordNewDownloadFile[] = [];
    const older: WordNewDownloadFile[] = [];
    for (const entry of entries) {
      if (seen.has(entry.build_type)) {
        older.push(entry);
      } else {
        seen.add(entry.build_type);
        latest.push(entry);
      }
    }
    return { platform, latest, older };
  });
}

/** The newest Android package, used for the in-app "update available" check. */
export function newestAndroid(manifest: WordNewDownloadManifest): WordNewDownloadFile | null {
  return newestFirst(manifest.files.filter((entry) => entry.platform === ANDROID_PLATFORM))[0] ?? null;
}
