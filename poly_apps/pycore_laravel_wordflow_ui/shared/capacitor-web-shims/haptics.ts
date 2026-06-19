/**
 * Web shim for @capacitor/haptics.
 *
 * Backs the Capacitor Haptics plugin with the browser Vibration API
 * (navigator.vibrate). Desktop browsers usually ignore vibration, and iOS
 * Safari has no vibration — these calls are then silent no-ops, which is the
 * correct degraded behavior. Aliased on the web build (see vite.config.ts).
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

export enum ImpactStyle {
  Heavy = 'HEAVY',
  Medium = 'MEDIUM',
  Light = 'LIGHT',
}

export enum NotificationType {
  Success = 'SUCCESS',
  Warning = 'WARNING',
  Error = 'ERROR',
}

export interface ImpactOptions {
  style: ImpactStyle;
}
export interface NotificationOptions {
  type: NotificationType;
}
export interface VibrateOptions {
  duration?: number;
}

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* unsupported — silent no-op */
  }
}

const IMPACT_MS: Record<ImpactStyle, number> = {
  [ImpactStyle.Heavy]: 40,
  [ImpactStyle.Medium]: 25,
  [ImpactStyle.Light]: 12,
};

const NOTIFY_PATTERN: Record<NotificationType, number[]> = {
  [NotificationType.Success]: [12, 40, 12],
  [NotificationType.Warning]: [20, 60, 20],
  [NotificationType.Error]: [40, 80, 40, 80, 40],
};

export const Haptics = {
  async impact(options: ImpactOptions = { style: ImpactStyle.Heavy }): Promise<void> {
    vibrate(IMPACT_MS[options.style] ?? 25);
  },
  async notification(options: NotificationOptions = { type: NotificationType.Success }): Promise<void> {
    vibrate(NOTIFY_PATTERN[options.type] ?? [12, 40, 12]);
  },
  async vibrate(options: VibrateOptions = {}): Promise<void> {
    vibrate(options.duration ?? 300);
  },
  async selectionStart(): Promise<void> {
    vibrate(8);
  },
  async selectionChanged(): Promise<void> {
    vibrate(6);
  },
  async selectionEnd(): Promise<void> {
    /* end of a selection gesture — no vibration on web */
  },
};

export default { Haptics, ImpactStyle, NotificationType };
