/** Wordnew toast entry point: dedups bursts, forwards to the shared notify center. */

import { notify } from '../../shared/notify/notify';

export type WfNewToastType = 'success' | 'info' | 'warning' | 'star';

const DEDUP_WINDOW_MS = 1500;

let lastKey = '';
let lastAt = 0;

export const wfNewNotify = {
  /** Show a toast. Identical text+type within DEDUP_WINDOW_MS is collapsed. */
  push(text: string, type: WfNewToastType = 'info'): void {
    if (!text) return;
    const now = Date.now();
    const key = `${type}|${text}`;
    if (key === lastKey && now - lastAt < DEDUP_WINDOW_MS) return;
    lastKey = key;
    lastAt = now;
    if (type === 'success') notify.success(text);
    else if (type === 'warning') notify.warning(text);
    else notify.info(text);
  },
};
