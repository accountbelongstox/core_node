/**
 * In-app APK update of an Android app (contract app_downloads.auto_update), one instance per app.
 *
 * Checks the published manifests (mesh origins first, then public; the first manifest that answers decides) on
 * start, on resume (after a minimum gap) and on an interval. A candidate must be the same build type, the same
 * application id and the same signing certificate as the installed app with a higher versionCode - the native
 * installer then updates in place and keeps all app data. The user confirms the download (banner / settings card)
 * and the system installer prompt; "install unknown apps" is asked once through the system settings.
 */
import { APP_AUTO_UPDATE } from '../../core/contracts/ServiceContract';
import { StorageManager, type StorageKey } from '../../core/persistence';
import { ChangeSignal } from '../../core/events/ChangeSignal';
import { appUpdateSupported, capAppUpdate, updateErrorCode, type CapInstalledApp } from './CapAppUpdate';
import { fetchAppManifest, fileUrl, type AppDownloadFile, type AppDownloadManifest } from './AppDownloads';
import type { AppUpdateSourceGroup } from './AppUpdateSources';

const MINUTE_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 20_000;
const ANDROID_PLATFORM = 'android';
const SHA_PREFIX_CHARS = 12;
const REQUEST_ID_PREFIX = 'app-update-';
const RETRY_NEXT_ORIGIN_CODES = new Set(['NETWORK_ERROR', 'HTTP_ERROR', 'HASH_MISMATCH', 'SIZE_MISMATCH']);

export type AppUpdateStatus =
  | 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'needsPermission' | 'installing' | 'error';

export interface AppUpdateCandidate {
  entry: AppDownloadFile;
  versionCode: number;
  /** Origin whose manifest listed it, then the other known sources (same file names). */
  origins: string[];
}

export interface AppUpdateSnapshot {
  supported: boolean;
  status: AppUpdateStatus;
  installed: CapInstalledApp | null;
  candidate: AppUpdateCandidate | null;
  /** The user chose "Later" for this candidate (the banner stays hidden; the settings card still offers it). */
  dismissed: boolean;
  bytes: number;
  total: number;
  errorCode: string;
  checkedAt: number;
  version: number;
}

export interface AppUpdaterConfig {
  /** Download app id (contract app_downloads: `<url_prefix><app>/`). */
  app: string;
  sourceGroups: () => AppUpdateSourceGroup[];
  dismissedKey: StorageKey;
  checkedAtKey: StorageKey;
  /** Resume hook of the app; defaults to the page becoming visible again. */
  onResume?: (listener: () => void) => void;
  /** Runs before a check (e.g. starts a host roster); returns its stop function. */
  beforeCheck?: () => () => void;
}

/** The newest manifest entry the installed app may update to in place; null when none. */
export function pickUpdateCandidate(manifest: AppDownloadManifest, installed: CapInstalledApp): AppDownloadFile | null {
  const signer = installed.signerSha256.toLowerCase();
  const eligible = manifest.files.filter((entry) => (
    entry.platform === ANDROID_PLATFORM
    && entry.build_type === installed.buildType
    && !!entry.application_id && entry.application_id === installed.applicationId
    && !!entry.signer_sha256 && entry.signer_sha256.toLowerCase() === signer
    && typeof entry.version_code === 'number' && entry.version_code > installed.versionCode
  ));
  return eligible.sort((left, right) => (right.version_code ?? 0) - (left.version_code ?? 0))[0] ?? null;
}

function onPageVisible(listener: () => void): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') listener();
  });
}

export class AppUpdater {
  private readonly changes = new ChangeSignal();
  private snapshot: AppUpdateSnapshot;
  private checking: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingFile = '';
  private stopBeforeCheck: (() => void) | null = null;

  readonly subscribe = this.changes.subscribe;

  readonly getSnapshot = (): AppUpdateSnapshot => this.snapshot;

  constructor(private readonly config: AppUpdaterConfig) {
    this.snapshot = this.build({
      supported: appUpdateSupported(), status: 'idle', installed: null, candidate: null, bytes: 0, total: 0, errorCode: '', checkedAt: 0,
    }, 0);
    if (!this.snapshot.supported) return;
    (config.onResume ?? onPageVisible)(() => this.onResume());
    this.schedule(APP_AUTO_UPDATE.checkOnStart ? FIRST_CHECK_DELAY_MS : APP_AUTO_UPDATE.checkIntervalMinutes * MINUTE_MS);
  }

  private build(next: Omit<AppUpdateSnapshot, 'dismissed' | 'version'>, version: number): AppUpdateSnapshot {
    const dismissedCode = StorageManager.get<number>(this.config.dismissedKey, 0);
    return { ...next, dismissed: !!next.candidate && next.candidate.versionCode <= dismissedCode, version };
  }

  private patch(change: Partial<Omit<AppUpdateSnapshot, 'dismissed' | 'version'>>): void {
    const { dismissed: _dismissed, version, ...current } = this.snapshot;
    this.snapshot = this.build({ ...current, ...change }, version + 1);
    this.changes.emit();
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.check(false).finally(() => this.schedule(APP_AUTO_UPDATE.checkIntervalMinutes * MINUTE_MS));
    }, delayMs);
  }

  private onResume(): void {
    const { status, checkedAt } = this.snapshot;
    if (status === 'needsPermission') {
      void this.continueInstall();
    } else if (status === 'installing') {
      this.patch({ status: 'available' });
    } else if (Date.now() - checkedAt >= APP_AUTO_UPDATE.checkOnResumeMinMinutes * MINUTE_MS) {
      void this.check(false);
    }
  }

  private busy(): boolean {
    const { status } = this.snapshot;
    return status === 'downloading' || status === 'installing' || status === 'needsPermission';
  }

  private firstAnswer(origins: string[]): Promise<{ origin: string; manifest: AppDownloadManifest } | null> {
    return new Promise((resolve) => {
      let pending = origins.length;
      if (!pending) {
        resolve(null);
        return;
      }
      for (const origin of origins) {
        void fetchAppManifest(origin, this.config.app).then((outcome) => {
          pending -= 1;
          if (outcome.kind === 'ok' && outcome.manifest.files.length) resolve({ origin: outcome.origin, manifest: outcome.manifest });
          else if (!pending) resolve(null);
        });
      }
    });
  }

  /** One check now (single-flight); `manual` surfaces "unreachable" as an error. */
  check(manual: boolean): Promise<void> {
    if (!this.snapshot.supported || this.busy()) return Promise.resolve();
    this.checking ??= this.runCheck(manual).finally(() => { this.checking = null; });
    return this.checking;
  }

  private async runCheck(manual: boolean): Promise<void> {
    this.patch({ status: 'checking', errorCode: '' });
    this.stopBeforeCheck ??= this.config.beforeCheck?.() ?? null;
    try {
      const installed = this.snapshot.installed ?? await capAppUpdate.installed();
      if (!installed) {
        this.patch({ status: 'idle', installed: null });
        return;
      }
      for (const group of this.config.sourceGroups()) {
        const answer = await this.firstAnswer(group.origins);
        if (!answer) continue;
        const entry = pickUpdateCandidate(answer.manifest, installed);
        const checkedAt = Date.now();
        StorageManager.set(this.config.checkedAtKey, checkedAt);
        if (!entry) {
          this.patch({ status: 'upToDate', installed, candidate: null, checkedAt });
          void capAppUpdate.cleanup();
          return;
        }
        const others = this.config.sourceGroups().flatMap((candidateGroup) => candidateGroup.origins);
        const origins = Array.from(new Set([answer.origin, ...others]));
        this.patch({ status: 'available', installed, candidate: { entry, versionCode: entry.version_code ?? 0, origins }, checkedAt });
        return;
      }
      this.patch(manual ? { status: 'error', installed, errorCode: 'unreachable' } : { status: this.snapshot.candidate ? 'available' : 'idle', installed });
    } finally {
      this.stopBeforeCheck?.();
      this.stopBeforeCheck = null;
    }
  }

  /** Download the candidate (resumable, sha256-verified) and hand it to the system installer. */
  async startUpdate(): Promise<void> {
    const { candidate, status } = this.snapshot;
    if (!candidate || !this.snapshot.supported || this.busy()) return;
    if (status === 'needsPermission' && this.pendingFile) {
      await this.continueInstall();
      return;
    }
    const { entry } = candidate;
    const fileName = `${this.config.app}-${candidate.versionCode}-${entry.sha256.slice(0, SHA_PREFIX_CHARS)}.apk`;
    const requestId = `${REQUEST_ID_PREFIX}${candidate.versionCode}`;
    this.patch({ status: 'downloading', bytes: 0, total: entry.size, errorCode: '' });
    let lastError = 'NETWORK_ERROR';
    for (const origin of candidate.origins) {
      try {
        await capAppUpdate.download({ requestId, url: fileUrl(origin, this.config.app, entry.file), fileName, sha256: entry.sha256, size: entry.size }, (progress) => {
          this.patch({ bytes: progress.bytes, total: progress.total || entry.size });
        });
        this.pendingFile = fileName;
        await this.installNow();
        return;
      } catch (error) {
        lastError = updateErrorCode(error);
        if (!RETRY_NEXT_ORIGIN_CODES.has(lastError)) break;
      }
    }
    this.patch({ status: 'error', errorCode: lastError });
  }

  private async installNow(): Promise<void> {
    try {
      await capAppUpdate.install(this.pendingFile);
      this.patch({ status: 'installing' });
    } catch (error) {
      const code = updateErrorCode(error);
      this.patch(code === 'NEED_INSTALL_PERMISSION' ? { status: 'needsPermission', errorCode: '' } : { status: 'error', errorCode: code });
    }
  }

  private async continueInstall(): Promise<void> {
    if (!this.pendingFile || !(await capAppUpdate.canInstall())) return;
    await this.installNow();
  }

  /** Opens the system "install unknown apps" page; the install continues when the app resumes with it allowed. */
  async allowInstall(): Promise<void> {
    await capAppUpdate.openInstallSettings().catch(() => undefined);
  }

  /** "Later": hide the banner for this candidate (a newer one shows again). */
  later(): void {
    const code = this.snapshot.candidate?.versionCode ?? 0;
    if (code) StorageManager.set(this.config.dismissedKey, code);
    this.patch({});
  }

  cancelDownload(): void {
    const code = this.snapshot.candidate?.versionCode;
    if (code) void capAppUpdate.cancel(`${REQUEST_ID_PREFIX}${code}`);
  }
}
