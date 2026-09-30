/* =============================================================================
 * CapDeviceStorage - storage volumes, usage and file hand-off
 * =============================================================================
 *
 * Native (Android, app plugin `DeviceStorage`): internal app data, shared
 * storage and removable SD cards with capacity / free space; "All files
 * access" for public folders; directory usage; FileProvider open / share of a
 * stored file. File I/O on a volume goes through @capacitor/filesystem with an
 * absolute path (`CapDirectory` null).
 * Web: one browser volume from the storage estimate (OPFS), a persistent-storage
 * grant as the access request, OPFS directory usage, download as hand-off.
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { getStorageEstimate, requestPersistentStorage } from './CapFilesystemCache';

export type CapVolumeKind = 'internal' | 'shared' | 'removable' | 'browser';

export interface CapStorageVolume {
  id: string;
  kind: CapVolumeKind;
  /** System description of the volume ('' when the system has none). */
  label: string;
  /** App-specific folder on the volume (no permission needed). */
  appPath: string;
  /** Volume root (public folders need all-files access). */
  rootPath: string;
  totalBytes: number;
  freeBytes: number;
  /** Android `Environment` state (`mounted`, ...). */
  state: string;
  removable: boolean;
}

export interface CapStorageVolumes {
  volumes: CapStorageVolume[];
  allFilesAccess: boolean;
}

export interface CapDirectoryStats {
  bytes: number;
  files: number;
}

export interface CapAllFilesAccess {
  granted: boolean;
  /** Android 11+: the grant is a system settings page, not a dialog. */
  settingsPage: boolean;
}

interface DeviceStoragePlugin {
  volumes(): Promise<CapStorageVolumes>;
  directoryStats(options: { path: string }): Promise<CapDirectoryStats>;
  checkAllFilesAccess(): Promise<CapAllFilesAccess>;
  requestAllFilesAccess(): Promise<CapAllFilesAccess>;
  openFile(options: { path: string; mimeType?: string }): Promise<void>;
  shareFile(options: { path: string; mimeType?: string }): Promise<void>;
}

const nativeStorage = registerPlugin<DeviceStoragePlugin>('DeviceStorage');
const BROWSER_VOLUME_ID = 'browser:0';

async function opfsStats(path: string): Promise<CapDirectoryStats> {
  const storage = (navigator as any)?.storage;
  if (!storage?.getDirectory) return { bytes: 0, files: 0 };
  let directory: any = await storage.getDirectory();
  for (const part of path.split('/').filter(Boolean)) {
    directory = await directory.getDirectoryHandle(part).catch(() => null);
    if (!directory) return { bytes: 0, files: 0 };
  }
  const totals: CapDirectoryStats = { bytes: 0, files: 0 };
  const walk = async (handle: any): Promise<void> => {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        await walk(entry);
      } else {
        totals.bytes += (await entry.getFile()).size;
        totals.files += 1;
      }
    }
  };
  await walk(directory);
  return totals;
}

class CapDeviceStorageService {
  isNative(): boolean {
    return isNativeAppShell();
  }

  async volumes(): Promise<CapStorageVolumes> {
    if (this.isNative()) return nativeStorage.volumes();
    const estimate = await getStorageEstimate();
    return {
      allFilesAccess: estimate.persisted,
      volumes: [{
        id: BROWSER_VOLUME_ID,
        kind: 'browser',
        label: '',
        appPath: '',
        rootPath: '',
        totalBytes: estimate.quotaBytes,
        freeBytes: Math.max(0, estimate.quotaBytes - estimate.usageBytes),
        state: 'mounted',
        removable: false,
      }],
    };
  }

  /** Usage of a folder: an absolute path natively, an OPFS path on the web. */
  directoryStats(path: string): Promise<CapDirectoryStats> {
    return this.isNative() ? nativeStorage.directoryStats({ path }) : opfsStats(path);
  }

  async checkAllFilesAccess(): Promise<CapAllFilesAccess> {
    if (this.isNative()) return nativeStorage.checkAllFilesAccess();
    return { granted: (await getStorageEstimate()).persisted, settingsPage: false };
  }

  async requestAllFilesAccess(): Promise<CapAllFilesAccess> {
    if (this.isNative()) return nativeStorage.requestAllFilesAccess();
    return { granted: await requestPersistentStorage(), settingsPage: false };
  }

  /** Open a stored file in another app (native FileProvider). */
  openFile(path: string, mimeType?: string): Promise<void> {
    return nativeStorage.openFile({ path, mimeType });
  }

  /** Share a stored file with another app (native FileProvider). */
  shareFile(path: string, mimeType?: string): Promise<void> {
    return nativeStorage.shareFile({ path, mimeType });
  }
}

export const capDeviceStorage = new CapDeviceStorageService();
