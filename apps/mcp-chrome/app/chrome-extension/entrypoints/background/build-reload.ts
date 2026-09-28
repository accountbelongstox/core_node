import serviceContract from '../../../../../../config/service_contract.json';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { logger } from '@/utils/logger';

const BUILD_STAMP_URL = chrome.runtime.getURL(serviceContract.mcp_chrome.build_stamp_file);
const BUILD_STAMP_POLL_MS = 2000;
const BUILD_STAMP_ALARM = 'build-stamp-watch';
const BUILD_STAMP_ALARM_MINUTES = 0.5;

let baselineStamp: string | null | undefined;

async function readBuildStamp(): Promise<string | null> {
  try {
    const response = await fetch(BUILD_STAMP_URL, { cache: 'no-store' });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

// The baseline lives in session storage, which Chrome clears on every extension
// reload: a service-worker restart keeps comparing against the loaded build.
async function loadBaseline(): Promise<string | null> {
  const stored = await chrome.storage.session.get(STORAGE_KEYS.BUILD_STAMP_BASELINE);
  const existing = stored[STORAGE_KEYS.BUILD_STAMP_BASELINE];
  if (typeof existing === 'string') return existing;
  const current = (await readBuildStamp()) ?? '';
  await chrome.storage.session.set({ [STORAGE_KEYS.BUILD_STAMP_BASELINE]: current });
  return current;
}

async function checkBuildStamp(): Promise<void> {
  if (baselineStamp === undefined) {
    baselineStamp = await loadBaseline();
  }
  const stamp = await readBuildStamp();
  if (stamp === null || stamp === baselineStamp) return;
  logger.info('BuildReload', 'New extension build detected; reloading.');
  chrome.runtime.reload();
}

export function initBuildReloadWatcher(): void {
  // Store-installed builds never change on disk; only unpacked builds reload.
  if ('update_url' in chrome.runtime.getManifest()) return;
  void checkBuildStamp();
  setInterval(() => void checkBuildStamp(), BUILD_STAMP_POLL_MS);
  void chrome.alarms.create(BUILD_STAMP_ALARM, { periodInMinutes: BUILD_STAMP_ALARM_MINUTES });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BUILD_STAMP_ALARM) void checkBuildStamp();
  });
}
