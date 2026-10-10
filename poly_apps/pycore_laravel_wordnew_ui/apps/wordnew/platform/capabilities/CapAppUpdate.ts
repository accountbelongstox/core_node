/* =============================================================================
 * CapAppUpdate - in-place self update of the Android app
 * =============================================================================
 * Native (Android, app plugin `AppUpdate`): the installed identity (applicationId, versionCode, signing
 * certificate, build type), a resumable sha256-verified APK download into the app-private cache, the "install
 * unknown apps" permission and the hand-off to the system installer. Web / desktop: unsupported (every call
 * resolves to a neutral value or rejects with UNSUPPORTED).
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { isDesktopAppShell } from '../../../../core/network/DesktopShell';

export interface CapInstalledApp {
  applicationId: string;
  versionCode: number;
  versionName: string;
  /** SHA-256 (lowercase hex) of the signing certificate. */
  signerSha256: string;
  buildType: string;
  canInstall: boolean;
}

export interface CapUpdateDownloadOptions {
  requestId: string;
  url: string;
  fileName: string;
  sha256: string;
  size: number;
}

export interface CapUpdateProgress {
  requestId: string;
  bytes: number;
  total: number;
}

export type CapUpdateErrorCode =
  | 'UNSUPPORTED' | 'INVALID_REQUEST' | 'ABORTED' | 'NETWORK_ERROR' | 'HTTP_ERROR' | 'HASH_MISMATCH' | 'SIZE_MISMATCH'
  | 'FILE_NOT_FOUND' | 'NEED_INSTALL_PERMISSION' | 'PACKAGE_MISMATCH' | 'SIGNER_MISMATCH' | 'VERSION_NOT_NEWER' | 'NO_HANDLER';

interface AppUpdatePlugin {
  info(): Promise<CapInstalledApp>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  download(options: CapUpdateDownloadOptions & { idleTimeoutMs?: number }): Promise<{ fileName: string; bytes: number; cached: boolean }>;
  cancel(options: { requestId: string }): Promise<void>;
  install(options: { fileName: string }): Promise<void>;
  cleanup(options: { keepFileName?: string }): Promise<{ removed: number }>;
  addListener(event: 'updateProgress', handler: (progress: CapUpdateProgress) => void): Promise<PluginListenerHandle>;
}

const nativeUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

/** The Android app shell: the only place an APK update applies. */
export function appUpdateSupported(): boolean {
  return isNativeAppShell() && !isDesktopAppShell();
}

export function updateErrorCode(error: unknown): CapUpdateErrorCode {
  const code = (error as { code?: string } | null)?.code;
  return (typeof code === 'string' ? code : 'NETWORK_ERROR') as CapUpdateErrorCode;
}

export const capAppUpdate = {
  installed(): Promise<CapInstalledApp | null> {
    return appUpdateSupported() ? nativeUpdate.info().catch(() => null) : Promise.resolve(null);
  },
  async canInstall(): Promise<boolean> {
    return appUpdateSupported() ? (await nativeUpdate.canInstall()).allowed : false;
  },
  openInstallSettings(): Promise<void> {
    return nativeUpdate.openInstallSettings();
  },
  async download(options: CapUpdateDownloadOptions, onProgress: (progress: CapUpdateProgress) => void): Promise<number> {
    const handle = await nativeUpdate.addListener('updateProgress', (progress) => {
      if (progress.requestId === options.requestId) onProgress(progress);
    });
    try {
      return (await nativeUpdate.download(options)).bytes;
    } finally {
      void handle.remove();
    }
  },
  cancel(requestId: string): Promise<void> {
    return nativeUpdate.cancel({ requestId }).catch(() => undefined);
  },
  install(fileName: string): Promise<void> {
    return nativeUpdate.install({ fileName });
  },
  cleanup(keepFileName?: string): Promise<void> {
    return appUpdateSupported() ? nativeUpdate.cleanup({ keepFileName }).then(() => undefined).catch(() => undefined) : Promise.resolve();
  },
};
