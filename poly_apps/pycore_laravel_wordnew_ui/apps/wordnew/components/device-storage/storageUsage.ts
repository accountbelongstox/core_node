import type { CapStorageVolume } from '../../platform/capabilities/CapDeviceStorage';

const FULL_SHARE_PERCENT = 90;

export interface VolumeUsage {
  used: number;
  total: number;
  share: number;
  full: boolean;
}

/** Used bytes and share of a volume; one derivation for the badge and the volume rows. */
export function volumeUsage(volume: CapStorageVolume | null): VolumeUsage {
  const total = volume?.totalBytes ?? 0;
  const used = volume ? Math.max(0, total - volume.freeBytes) : 0;
  const share = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return { used, total, share, full: share > FULL_SHARE_PERCENT };
}
