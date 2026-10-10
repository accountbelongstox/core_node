/**
 * Published app packages of one app (contract app_downloads): `<origin><url_prefix><app>/<manifest_file>` lists every
 * build the build scripts published; the files sit next to it. Shared by every app that offers downloads or updates.
 */
import { APP_DOWNLOADS } from '../../core/contracts/ServiceContract';
import { protocolFetch } from '../../core/network/ProtocolFetch';
import { isNativeAppShell } from '../../core/network/NativeShell';
import { isDesktopAppShell } from '../../core/network/DesktopShell';

const MANIFEST_TIMEOUT_MS = 8000;
const PLATFORM_ORDER = ['android', 'windows', 'linux'] as const;
const ANDROID_PLATFORM = 'android';

export interface AppDownloadFile {
  platform: string;
  build_type: string;
  version: string;
  /** Android only: versionCode, package id and signing certificate (contract app_downloads.manifest). */
  version_code?: number;
  application_id?: string;
  signer_sha256?: string;
  file: string;
  latest: string;
  size: number;
  sha256: string;
  built_at: string;
}

export interface AppDownloadManifest {
  app: string;
  name: string;
  files: AppDownloadFile[];
  updated_at: string;
}

export type AppDownloadResult =
  | { state: 'ready'; origin: string; manifest: AppDownloadManifest }
  | { state: 'notPublished' }
  | { state: 'unreachable' };

export type AppManifestOutcome =
  | { kind: 'ok'; origin: string; manifest: AppDownloadManifest }
  | { kind: 'missing' }
  | { kind: 'error' };

export interface AppDownloadGroup {
  platform: string;
  latest: AppDownloadFile[];
  older: AppDownloadFile[];
}

export function downloadBaseUrl(origin: string, app: string): string {
  return `${origin}${APP_DOWNLOADS.urlPrefix}${app}/`;
}

export function manifestUrl(origin: string, app: string): string {
  return `${downloadBaseUrl(origin, app)}${APP_DOWNLOADS.manifestFile}`;
}

export function fileUrl(origin: string, app: string, file: string): string {
  return `${downloadBaseUrl(origin, app)}${encodeURIComponent(file)}`;
}

function parseManifest(value: unknown, app: string): AppDownloadManifest | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AppDownloadManifest>;
  if (!Array.isArray(record.files)) return null;
  const files = record.files.filter((entry): entry is AppDownloadFile => (
    !!entry && typeof entry.file === 'string' && typeof entry.platform === 'string' && typeof entry.version === 'string'
  ));
  return {
    app: String(record.app ?? app),
    name: String(record.name ?? app),
    files,
    updated_at: String(record.updated_at ?? ''),
  };
}

/** One origin's manifest: ok, missing (answered without one) or error (no answer). */
export async function fetchAppManifest(origin: string, app: string): Promise<AppManifestOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await protocolFetch(manifestUrl(origin, app), { cache: 'no-store', signal: controller.signal });
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const manifest = parseManifest(await response.json().catch(() => null), app);
    return manifest ? { kind: 'ok', origin, manifest } : { kind: 'missing' };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** Probes every origin in parallel; the first manifest that lists a package wins. */
export function fetchAppDownloads(origins: string[], app: string): Promise<AppDownloadResult> {
  return new Promise((resolve) => {
    let pending = origins.length;
    let missing = false;
    let settled = false;
    const finish = (result: AppDownloadResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    if (!pending) {
      finish({ state: 'unreachable' });
      return;
    }
    for (const origin of origins) {
      void fetchAppManifest(origin, app).then((outcome) => {
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

/** The Android app shell (the only shell an APK update applies to). */
export function isAndroidAppShell(): boolean {
  return isNativeAppShell() && !isDesktopAppShell();
}

function newestFirst(files: AppDownloadFile[]): AppDownloadFile[] {
  return [...files].sort((left, right) => right.built_at.localeCompare(left.built_at));
}

/** Per platform: the newest package of each build type, and the older ones. */
export function groupByPlatform(manifest: AppDownloadManifest): AppDownloadGroup[] {
  const ordered = [...PLATFORM_ORDER, ...manifest.files.map((entry) => entry.platform)];
  const platforms = Array.from(new Set(ordered)).filter((platform) => manifest.files.some((entry) => entry.platform === platform));
  const detected = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? ANDROID_PLATFORM : '';
  platforms.sort((left, right) => Number(right === detected) - Number(left === detected));
  return platforms.map((platform) => {
    const entries = newestFirst(manifest.files.filter((entry) => entry.platform === platform));
    const seen = new Set<string>();
    const latest: AppDownloadFile[] = [];
    const older: AppDownloadFile[] = [];
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
