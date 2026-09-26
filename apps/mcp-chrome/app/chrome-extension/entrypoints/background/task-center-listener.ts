/**
 * Task Center Message Listener
 * Handles messages from popup to control the unified task center
 */

import { taskCenter, type TaskCenterConfig } from './services/task-center/TaskCenter';
import { bingDictionaryWorkerService } from './services/bing-dictionary-worker-service';
import {
  getRunIntent,
  setRunIntent,
  clearRunIntent,
} from './services/task-center/run-intent';
import {
  CAPABILITIES,
  CAPABILITY_BY_KEY,
  capabilitiesForProcessors,
  processorsForCapabilities,
  sanitizeCapabilities,
  type CapabilityKey,
} from '@/utils/task-capabilities';
import {
  TASK_CENTER_MSG,
  VALIDITY_TEST_MSG,
  SUBMIT_OUTBOX_MSG,
  DEFAULT_TARGET_LANG,
  toTaskCenterSettings,
  withApiBase,
  type FullTaskCenterStatus,
  type TaskCenterSettings,
} from '@/utils/task-center-types';
import { submitOutbox } from './services/outbox/submit-outbox';
import { LANES } from '@/utils/task-center-lanes';
import { runWordValidityClassification } from './services/word-validity/word-validity-web-runtime';
import type { AiWebProvider } from './tools/browser/ai-web-common';
import { STORAGE_KEYS, UI_STORAGE_PREFIX } from '@/utils/storage-keys';
import { AsyncOperationController } from '@/utils/async';
import { apiManager, ensureApiManagerReady, getApiBase, resolveApiBase } from '@/services/ApiManager';

interface PersistedTaskCenterRuntime {
  running: boolean;
  config: TaskCenterSettings | null;
}

const TASK_CENTER_RUNTIME_KEY = STORAGE_KEYS.TASK_CENTER_RUNTIME;
const TASK_CENTER_WATCHDOG_ALARM = STORAGE_KEYS.TASK_CENTER_WATCHDOG_ALARM;
const BING_WATCHDOG_ALARM = STORAGE_KEYS.BING_WATCHDOG_ALARM;
const WATCHDOG_PERIOD_MINUTES = 1;
const runtimeRestore = new AsyncOperationController<void>();
const CAPABILITY_BY_STORAGE_KEY = new Map<string, CapabilityKey>(
  CAPABILITIES.map((capability) => [
    `${UI_STORAGE_PREFIX}${capability.storageKey}`,
    capability.key,
  ]),
);

/**
 * Last successful start config (with the API base every running lane uses), so
 * a live `set_capability` toggle joins the running lanes without a restart.
 */
let lastStartConfig: TaskCenterConfig | null = null;
let runtimeEpoch = 0;
let lifecycleQueue: Promise<void> = Promise.resolve();

/**
 * Initialize message listener for Task Center
 */
export function initTaskCenterListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === TASK_CENTER_MSG) {
      handleTaskCenterMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    }
    if (message.type === VALIDITY_TEST_MSG) {
      handleValidityTestMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    }
    if (message.type === SUBMIT_OUTBOX_MSG) {
      // Read-only status probe for the Settings "Pending retries" line.
      sendResponse({ success: true, status: submitOutbox.getStatus() });
      return true;
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TASK_CENTER_WATCHDOG_ALARM || alarm.name === BING_WATCHDOG_ALARM) {
      void restoreTaskCenterRuntime();
    }
  });
  chrome.runtime.onStartup.addListener(() => {
    void restoreTaskCenterRuntime();
  });
  chrome.runtime.onInstalled.addListener(() => {
    void restoreTaskCenterRuntime();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') void applyCapabilityStorageChanges(changes);
  });
  followApiEndpoint();
  console.log('[Task Center Listener] Initialized');
}

/**
 * The background follows the global endpoint (`api_settings` through
 * ApiManager) and re-points running workers itself; no popup is involved.
 */
function followApiEndpoint(): void {
  apiManager.onEndpointChange(() => {
    enqueueEndpointRepoint().catch((error) => {
      console.error('[Task Center] Endpoint re-point failed:', error);
    });
  });
  ensureApiManagerReady().catch((error) => {
    console.error('[Task Center] Failed to load API settings:', error);
  });
}

/**
 * Serialize a re-point behind queued lifecycle actions and any pending restore.
 * Unlike runLifecycleAction it does not bump runtimeEpoch: an endpoint change
 * must never supersede a service-worker restore or a user start.
 */
function enqueueEndpointRepoint(): Promise<void> {
  const pendingRestore = runtimeRestore.current;
  const operation = lifecycleQueue.then(async () => {
    if (pendingRestore) await pendingRestore;
    await repointRunningWorkers();
  });
  lifecycleQueue = operation.catch(() => undefined);
  return operation;
}

/**
 * Move every running lane to the current API base. A running center is
 * reconfigured as a whole; lanes started outside it are re-pointed one by one
 * and keep their own settings.
 */
async function repointRunningWorkers(): Promise<void> {
  const apiUrl = getApiBase();
  if (taskCenter.isTaskCenterRunning()) {
    if (lastStartConfig?.apiUrl === apiUrl) return;
    console.log(`[Task Center] API endpoint changed -> ${apiUrl}; re-pointing workers`);
    await handleReconfigure((response) => {
      if (!response?.success) console.error('[Task Center] Endpoint re-point failed:', response?.error);
    });
    return;
  }

  for (const processor of taskCenter.getAllProcessors()) {
    if (!processor.getStatus().isRunning) continue;
    try {
      await processor.repoint(apiUrl);
    } catch (error) {
      console.error(`[Task Center] Failed to re-point ${processor.processorType}:`, error);
    }
  }
}

/**
 * Compose the full Task Center status the popup consumes: the base
 * isRunning/stats + the aggregated backend health (from TaskCenter) + the
 * persisted active capabilities (run-intent).
 */
async function buildFullStatus(): Promise<FullTaskCenterStatus> {
  const status = taskCenter.getStatus(); // { isRunning, stats, backend }
  const intent = await getRunIntent();
  return {
    ...status,
    activeApiUrl: lastStartConfig?.apiUrl || null,
    activeCapabilities: intent.activeCapabilities,
  };
}

async function persistCapabilitySelection(activeCapabilities: CapabilityKey[]): Promise<void> {
  const active = new Set(activeCapabilities);
  const values = Object.fromEntries(
    CAPABILITIES.map((capability) => [
      `${UI_STORAGE_PREFIX}${capability.storageKey}`,
      active.has(capability.key),
    ]),
  );
  try {
    await chrome.storage.local.set(values);
  } catch (error) {
    console.error('[Task Center] Failed to persist capability selection:', error);
  }
}

async function getPersistedCapabilitySelection(): Promise<CapabilityKey[]> {
  const storageKeys = CAPABILITIES.map((capability) =>
    `${UI_STORAGE_PREFIX}${capability.storageKey}`,
  );
  const values = await chrome.storage.local.get(storageKeys);

  return CAPABILITIES
    .filter((capability) => values[`${UI_STORAGE_PREFIX}${capability.storageKey}`] === true)
    .map((capability) => capability.key);
}

/** Persisted Task Center settings bound to the given capabilities (never an API base). */
async function loadPersistedSettings(activeCapabilities: CapabilityKey[]): Promise<TaskCenterSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.TASK_CENTER_CONFIG);
  return {
    ...toTaskCenterSettings(stored[STORAGE_KEYS.TASK_CENTER_CONFIG] as TaskCenterSettings | undefined),
    activeCapabilities,
    enabledProcessors: processorsForCapabilities(activeCapabilities),
  };
}

async function applyCapabilityStorageChanges(
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
): Promise<void> {
  for (const [storageKey, change] of Object.entries(changes)) {
    const capability = CAPABILITY_BY_STORAGE_KEY.get(storageKey);
    if (!capability || typeof change.newValue !== 'boolean') continue;
    await runLifecycleAction(() => handleSetCapability(
      capability,
      change.newValue === true,
      undefined,
      () => undefined,
    ));
  }
}

async function persistTaskCenterRuntime(
  running: boolean,
  config: TaskCenterConfig | null,
): Promise<void> {
  const settings = running && config ? toTaskCenterSettings(config) : null;
  const payload: PersistedTaskCenterRuntime = { running, config: settings };

  if (settings) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.TASK_CENTER_CONFIG]: settings });
    } catch (error) {
      console.error('[Task Center] Failed to persist configuration:', error);
    }
  }

  try {
    await chrome.storage.session.set({ [TASK_CENTER_RUNTIME_KEY]: payload });
  } catch (error) {
    console.error('[Task Center] Failed to persist session runtime:', error);
  }

  try {
    if (running) {
      await chrome.alarms.create(TASK_CENTER_WATCHDOG_ALARM, {
        delayInMinutes: WATCHDOG_PERIOD_MINUTES,
        periodInMinutes: WATCHDOG_PERIOD_MINUTES,
      });
    } else {
      await chrome.alarms.clear(TASK_CENTER_WATCHDOG_ALARM);
    }
  } catch (error) {
    console.error('[Task Center] Failed to reconcile watchdog:', error);
  }
}

async function performRuntimeRestore(): Promise<void> {
  const restoreEpoch = runtimeEpoch;

  const [intent, stored, localStored, apiUrl] = await Promise.all([
    getRunIntent(),
    chrome.storage.session.get(TASK_CENTER_RUNTIME_KEY),
    chrome.storage.local.get(STORAGE_KEYS.TASK_CENTER_CONFIG),
    resolveApiBase(),
  ]);
  if (restoreEpoch !== runtimeEpoch) return;

  const runtime = stored[TASK_CENTER_RUNTIME_KEY] as PersistedTaskCenterRuntime | undefined;
  if (!intent.running) {
    await persistTaskCenterRuntime(false, null);
    await bingDictionaryWorkerService.stopAndClear(true);
    return;
  }
  const activeCapabilities = sanitizeCapabilities(intent.activeCapabilities);
  const enabledProcessors = processorsForCapabilities(activeCapabilities);
  const settings = toTaskCenterSettings(
    runtime?.running && runtime.config
      ? runtime.config
      : localStored[STORAGE_KEYS.TASK_CENTER_CONFIG] as TaskCenterSettings | undefined,
  );

  const processors = { ...(settings.processors || {}) };
  if (enabledProcessors.includes(LANES.BING_DICTIONARY)) {
    processors[LANES.BING_DICTIONARY] = {
      ...(processors[LANES.BING_DICTIONARY] || {}),
      surface: false,
    };
  }
  const centerWasRunning = taskCenter.isTaskCenterRunning();
  // Running lanes keep the base they run on; repointRunningWorkers moves them.
  const runtimeApiUrl = centerWasRunning && lastStartConfig ? lastStartConfig.apiUrl : apiUrl;
  const config = withApiBase({
    ...settings,
    processors,
    activeCapabilities,
    enabledProcessors,
  }, runtimeApiUrl);
  let centerStarted = false;

  try {
    if (!centerWasRunning) {
      await taskCenter.startAll(config);
      centerStarted = true;
    }
    if (restoreEpoch !== runtimeEpoch) {
      if (centerStarted) taskCenter.stopAll();
      return;
    }
    lastStartConfig = config;
    await persistTaskCenterRuntime(true, config);
    await persistCapabilitySelection(activeCapabilities);
    if (restoreEpoch !== runtimeEpoch) {
      if (centerStarted) taskCenter.stopAll();
      if (lastStartConfig === config) lastStartConfig = null;
      return;
    }
    console.log('[Task Center] Restored runtime after service-worker restart');
  } catch (error) {
    if (centerStarted) taskCenter.stopAll();
    console.error('[Task Center] Runtime restore failed:', error);
  }
}

export function restoreTaskCenterRuntime(): Promise<void> {
  return runtimeRestore.run(() => lifecycleQueue
      .then(() => performRuntimeRestore())
      .catch((error) => {
        console.error('[Task Center] Runtime restore failed:', error);
      }));
}

async function runLifecycleAction(action: () => Promise<void>): Promise<void> {
  const pendingRestore = runtimeRestore.current;
  // A preemptive Stop bumps runtimeEpoch outside this queue; an action still
  // WAITING here when that happens must be dropped, not run after the Stop.
  const enqueueEpoch = runtimeEpoch;
  const operation = lifecycleQueue.then(async () => {
    const superseded = runtimeEpoch !== enqueueEpoch;
    runtimeEpoch++;
    if (pendingRestore) await pendingRestore;
    if (superseded) return;
    await action();
  });
  lifecycleQueue = operation.catch(() => undefined);
  await operation;
}

/**
 * Stop is the escape hatch: it must NEVER queue behind a hung start/restore
 * (d.txt 6.2.2 — clicking Stop had no effect while a start was stuck in
 * retries behind a dead endpoint). It bumps runtimeEpoch so any in-flight
 * restore/start self-rolls-back, then tears everything down immediately
 * instead of joining lifecycleQueue.
 */
async function runStopAction(sendResponse: (response: any) => void): Promise<void> {
  runtimeEpoch++;
  taskCenter.stopAll();
  // Belt-and-suspenders: force-clear the Bing watchdog + session run-intent
  // so the crawler can NEVER resurrect after Stop (even if its processor
  // was not running in this SW instance).
  await bingDictionaryWorkerService.stopAndClear(true);
  await clearRunIntent();
  await persistTaskCenterRuntime(false, null);
  lastStartConfig = null;
  sendResponse({
    success: true,
    message: 'Task Center stopped',
    status: await buildFullStatus(),
  });
}

/**
 * Handle the single-feature validity diagnostic. Production validity work is
 * owned exclusively by the word_validity_web global-task processor.
 */
async function handleValidityTestMessage(
  message: {
    type: string;
    words?: string[];
    provider?: AiWebProvider;
    targetLanguage?: string;
  },
  sendResponse: (response: any) => void,
) {
  try {
    const words = Array.isArray(message.words)
      ? message.words
          .map((word) => String(word).trim())
          .filter(Boolean)
          .map((word) => ({ word }))
      : [];
    if (words.length === 0) {
      sendResponse({ success: false, error: 'Enter at least one word' });
      return;
    }
    const result = await runWordValidityClassification(
      words,
      message.provider,
      message.targetLanguage || DEFAULT_TARGET_LANG,
    );
    sendResponse({ success: true, result });
  } catch (error: any) {
    console.error('[Validity Test] Error:', error);
    sendResponse({ success: false, error: error?.message || 'Unknown error' });
  }
}

export function executeValidityTestCommand(message: {
  words?: string[];
  provider?: AiWebProvider;
  targetLanguage?: string;
}): Promise<any> {
  return new Promise((resolve) => {
    void handleValidityTestMessage(
      { type: VALIDITY_TEST_MSG, ...message },
      resolve,
    );
  });
}

/**
 * Handle Task Center messages
 */
async function handleTaskCenterMessage(
  message: {
    type: string;
    action: string;
    config?: TaskCenterSettings;
    processorType?: string;
    capability?: CapabilityKey;
    enabled?: boolean;
  },
  sendResponse: (response: any) => void,
) {
  try {
    switch (message.action) {
      case 'start': {
        await runLifecycleAction(() => handleStart(message.config, sendResponse));
        break;
      }

      case 'stop': {
        await runStopAction(sendResponse);
        break;
      }

      case 'set_capability': {
        await runLifecycleAction(() =>
          handleSetCapability(
            message.capability,
            message.enabled === true,
            message.config,
            sendResponse,
          ),
        );
        break;
      }

      case 'get_status': {
        if (runtimeRestore.current) await runtimeRestore.current;
        sendResponse({ success: true, ...(await buildFullStatus()) });
        break;
      }

      case 'enable_processor': {
        if (!message.processorType) {
          sendResponse({ success: false, error: 'Processor type is required' });
          return;
        }
        taskCenter.enableProcessor(message.processorType);
        sendResponse({ success: true, message: `Processor ${message.processorType} enabled` });
        break;
      }

      case 'disable_processor': {
        if (!message.processorType) {
          sendResponse({ success: false, error: 'Processor type is required' });
          return;
        }
        taskCenter.disableProcessor(message.processorType);
        sendResponse({ success: true, message: `Processor ${message.processorType} disabled` });
        break;
      }

      case 'start_processor': {
        if (!message.processorType) {
          sendResponse({ success: false, error: 'Processor type is required' });
          return;
        }
        await taskCenter.startProcessor(message.processorType, {
          ...(message.config || {}),
          apiUrl: await resolveApiBase(),
        });
        sendResponse({ success: true, message: `Processor ${message.processorType} started` });
        break;
      }

      case 'stop_processor': {
        if (!message.processorType) {
          sendResponse({ success: false, error: 'Processor type is required' });
          return;
        }
        taskCenter.stopProcessor(message.processorType);
        sendResponse({ success: true, message: `Processor ${message.processorType} stopped` });
        break;
      }

      default: {
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      }
    }
  } catch (error: any) {
    console.error('[Task Center Listener] Error:', error);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

export function executeTaskCenterCommand(message: {
  action: string;
  config?: TaskCenterSettings;
  processorType?: string;
  capability?: CapabilityKey;
  enabled?: boolean;
}): Promise<any> {
  return new Promise((resolve) => {
    void handleTaskCenterMessage(
      { type: TASK_CENTER_MSG, ...message },
      resolve,
    );
  });
}

/**
 * Start assist. `settings.activeCapabilities` (from the popup checkboxes) is the
 * authoritative allowlist: it is translated to the TaskCenter processor
 * allowlist via the shared catalog and persisted as run-intent. Back-compat: if
 * activeCapabilities is absent but a raw enabledProcessors list is present, that
 * is honored and the capabilities are derived from it. The API base always
 * comes from ApiManager; only a rollback passes the previous base explicitly.
 */
async function handleStart(
  settings: TaskCenterSettings | undefined,
  sendResponse: (response: any) => void,
  apiUrlOverride?: string,
) {
  const startEpoch = runtimeEpoch;
  const apiUrl = apiUrlOverride || await resolveApiBase();
  const config = withApiBase(settings, apiUrl);

  // Resolve the active capabilities + the processor allowlist they map to.
  const hasCapabilitySelection = Array.isArray(config.activeCapabilities);
  let activeCapabilities = sanitizeCapabilities(config.activeCapabilities);
  let enabledProcessors: string[];
  if (hasCapabilitySelection) {
    enabledProcessors = processorsForCapabilities(activeCapabilities);
  } else if (Array.isArray(config.enabledProcessors)) {
    enabledProcessors = config.enabledProcessors;
    activeCapabilities = capabilitiesForProcessors(enabledProcessors);
  } else {
    enabledProcessors = [];
  }
  config.activeCapabilities = activeCapabilities;
  config.enabledProcessors = enabledProcessors;

  // The center itself always starts. Capabilities only control execution lanes.
  const centerWasRunning = taskCenter.isTaskCenterRunning();
  // Lanes still bound to another API base are released first, so no processor
  // keeps talking to the previous backend.
  if (centerWasRunning && lastStartConfig && lastStartConfig.apiUrl !== apiUrl) {
    taskCenter.stopAll();
  }
  try {
    if (activeCapabilities.includes('validity') && !enabledProcessors.includes(LANES.BING_DICTIONARY)) {
      await bingDictionaryWorkerService.stopAndClear(true);
    }
    await taskCenter.startAll(config);

    if (startEpoch !== runtimeEpoch) {
      taskCenter.stopAll();
      sendResponse({ success: false, error: 'Start superseded by Stop' });
      return;
    }
  } catch (error) {
    if (!centerWasRunning) taskCenter.stopAll();
    throw error;
  }

  // A Stop landed while the lanes were starting — roll back instead of
  // resurrecting a running state the user already cancelled (d.txt 6.2.2).
  if (startEpoch !== runtimeEpoch) {
    taskCenter.stopAll();
    sendResponse({ success: false, error: 'Start superseded by Stop' });
    return;
  }

  lastStartConfig = config;
  await setRunIntent({ running: true, activeCapabilities });
  await persistTaskCenterRuntime(true, config);
  await persistCapabilitySelection(activeCapabilities);

  sendResponse({
    success: true,
    message: 'Task Center started',
    status: await buildFullStatus(),
  });
}

/**
 * Move every active lane to the current shared API endpoint without mixing task
 * ownership across backends. stop() lets an already-claimed task finish on its
 * original client; each processor's next start waits for that cycle to settle.
 * A failed new start restores the last known-good runtime.
 */
async function handleReconfigure(sendResponse: (response: any) => void): Promise<void> {
  const previousIntent = await getRunIntent();
  const previousConfig = lastStartConfig
    ? {
        ...lastStartConfig,
        processors: { ...(lastStartConfig.processors || {}) },
        activeCapabilities: previousIntent.activeCapabilities,
        enabledProcessors: processorsForCapabilities(previousIntent.activeCapabilities),
      }
    : null;

  const nextSettings = previousConfig
    ? toTaskCenterSettings(previousConfig)
    : await loadPersistedSettings(previousIntent.activeCapabilities);

  taskCenter.stopAll();

  try {
    await handleStart(nextSettings, sendResponse);
  } catch (error) {
    if (previousConfig?.apiUrl && previousIntent.running) {
      try {
        await handleStart(toTaskCenterSettings(previousConfig), () => undefined, previousConfig.apiUrl);
      } catch (rollbackError) {
        console.error('[Task Center] Failed to restore previous configuration:', rollbackError);
      }
    }
    throw error;
  }
}

/**
 * Live capability toggle WITHOUT a full restart. Enables/disables the
 * capability's processors (and its validity runner, if any) directly, then
 * updates run-intent's activeCapabilities.
 */
async function handleSetCapability(
  capability: CapabilityKey | undefined,
  enabled: boolean,
  settings: TaskCenterSettings | undefined,
  sendResponse: (response: any) => void,
) {
  if (!capability || !(capability in CAPABILITY_BY_KEY)) {
    sendResponse({ success: false, error: `Unknown capability: ${capability}` });
    return;
  }
  const capEpoch = runtimeEpoch;
  const def = CAPABILITY_BY_KEY[capability];
  const intent = await getRunIntent();
  if (!intent.running) {
    const selectedCapabilities = await getPersistedCapabilitySelection();
    const selectedSet = new Set(selectedCapabilities);
    const wasSelected = selectedSet.has(capability);
    if (wasSelected !== enabled) {
      if (enabled) selectedSet.add(capability);
      else selectedSet.delete(capability);
      await persistCapabilitySelection(Array.from(selectedSet));
    }
    sendResponse({ success: true, status: await buildFullStatus() });
    return;
  }
  const wasEnabled = intent.activeCapabilities.includes(capability);
  if (wasEnabled === enabled) {
    sendResponse({ success: true, status: await buildFullStatus() });
    return;
  }
  const capSet = new Set(intent.activeCapabilities);
  if (enabled) capSet.add(capability);
  else capSet.delete(capability);
  const activeCapabilities = Array.from(capSet);

  // Reuse the complete last/start config so live toggles keep each processor's
  // persisted batch, interval, language, and parallelism settings. A toggled
  // lane joins the running lanes on their API base; an endpoint change moves
  // all of them together (repointRunningWorkers).
  const apiUrl = lastStartConfig?.apiUrl || await resolveApiBase();
  const baseSettings = toTaskCenterSettings(lastStartConfig || settings);
  const overrideSettings = settings ? toTaskCenterSettings(settings) : null;

  const previousProcessors = processorsForCapabilities(intent.activeCapabilities);
  const enabledProcessors = processorsForCapabilities(activeCapabilities);
  const previousConfig: TaskCenterConfig = withApiBase({
    ...baseSettings,
    activeCapabilities: [...intent.activeCapabilities],
    enabledProcessors: previousProcessors,
  }, apiUrl);
  const nextConfig: TaskCenterConfig = withApiBase({
    ...baseSettings,
    ...(overrideSettings || {}),
    processors: {
      ...(baseSettings.processors || {}),
      ...(overrideSettings?.processors || {}),
    },
    activeCapabilities,
    enabledProcessors,
  }, apiUrl);

  try {
    await taskCenter.syncProcessors(enabledProcessors, nextConfig);
    if (capEpoch !== runtimeEpoch) {
      taskCenter.stopAll();
      sendResponse({ success: false, error: 'Capability change superseded by Stop' });
      return;
    }
  } catch (error: any) {
    try {
      await taskCenter.syncProcessors(previousProcessors, previousConfig);
    } catch (rollbackError) {
      console.error('[Task Center] Failed to roll back capability change:', rollbackError);
    }
    sendResponse({
      success: false,
      error: error?.message || `Failed to update capability: ${capability}`,
    });
    return;
  }

  if (
    !enabled &&
    def.processors.includes(LANES.BING_DICTIONARY) &&
    !enabledProcessors.includes(LANES.BING_DICTIONARY)
  ) {
    await bingDictionaryWorkerService.stopAndClear();
  }

  // A Stop landed mid-toggle — do not resurrect run-intent (d.txt 6.2.2).
  if (capEpoch !== runtimeEpoch) {
    taskCenter.stopAll();
    sendResponse({ success: false, error: 'Capability change superseded by Stop' });
    return;
  }

  lastStartConfig = nextConfig;
  await setRunIntent({ running: true, activeCapabilities });
  await persistTaskCenterRuntime(true, nextConfig);
  await persistCapabilitySelection(activeCapabilities);

  sendResponse({ success: true, status: await buildFullStatus() });
}
