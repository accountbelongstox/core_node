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
  type FullTaskCenterStatus,
} from '@/utils/task-center-types';
import { submitOutbox } from './services/outbox/submit-outbox';
import { LANES } from '@/utils/task-center-lanes';
import { runWordValidityClassification } from './services/word-validity/word-validity-web-runtime';
import type { AiWebProvider } from './tools/browser/ai-web-common';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { AsyncOperationController } from '@/utils/async';
import { DEFAULT_API_BASE_URL } from '@/config/api-endpoints';

interface PersistedTaskCenterRuntime {
  running: boolean;
  config: TaskCenterConfig | null;
}

const TASK_CENTER_RUNTIME_KEY = STORAGE_KEYS.TASK_CENTER_RUNTIME;
const TASK_CENTER_WATCHDOG_ALARM = STORAGE_KEYS.TASK_CENTER_WATCHDOG_ALARM;
const BING_WATCHDOG_ALARM = STORAGE_KEYS.BING_WATCHDOG_ALARM;
const WATCHDOG_PERIOD_MINUTES = 1;
const runtimeRestore = new AsyncOperationController<void>();

/**
 * Last successful start config, so a live `set_capability` toggle can start a
 * lane with the same apiUrl the user started with (no full restart needed).
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
  console.log('[Task Center Listener] Initialized');
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

async function persistTaskCenterRuntime(
  running: boolean,
  config: TaskCenterConfig | null,
): Promise<void> {
  const payload: PersistedTaskCenterRuntime = { running, config: running ? config : null };
  try {
    await chrome.storage.session.set({ [TASK_CENTER_RUNTIME_KEY]: payload });
    if (running) {
      await chrome.alarms.create(TASK_CENTER_WATCHDOG_ALARM, {
        delayInMinutes: WATCHDOG_PERIOD_MINUTES,
        periodInMinutes: WATCHDOG_PERIOD_MINUTES,
      });
    } else {
      await chrome.alarms.clear(TASK_CENTER_WATCHDOG_ALARM);
    }
  } catch (error) {
    console.error('[Task Center] Failed to persist runtime:', error);
  }
}

async function performRuntimeRestore(): Promise<void> {
  const restoreEpoch = runtimeEpoch;

  const [intent, stored] = await Promise.all([
    getRunIntent(),
    chrome.storage.session.get(TASK_CENTER_RUNTIME_KEY),
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
  const runtimeConfig: TaskCenterConfig = runtime?.running && runtime.config?.apiUrl
    ? runtime.config
    : {
        apiUrl: intent.apiUrl || DEFAULT_API_BASE_URL,
        processors: {},
        activeCapabilities,
        enabledProcessors,
      };

  const processors = { ...(runtimeConfig.processors || {}) };
  if (enabledProcessors.includes(LANES.BING_DICTIONARY)) {
    processors[LANES.BING_DICTIONARY] = {
      ...(processors[LANES.BING_DICTIONARY] || { apiUrl: runtimeConfig.apiUrl }),
      apiUrl: runtimeConfig.apiUrl,
      surface: false,
    };
  }
  const config = {
    ...runtimeConfig,
    processors,
    activeCapabilities,
    enabledProcessors,
  };
  const centerWasRunning = taskCenter.isTaskCenterRunning();
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
    config?: TaskCenterConfig;
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

      case 'reconfigure': {
        await runLifecycleAction(() => handleReconfigure(message.config, sendResponse));
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
        await taskCenter.startProcessor(message.processorType, message.config);
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
  config?: TaskCenterConfig;
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
 * Start assist. `config.activeCapabilities` (from the popup checkboxes) is the
 * authoritative allowlist: it is translated to the TaskCenter processor
 * allowlist via the shared catalog and persisted as run-intent. Back-compat: if
 * activeCapabilities is absent but a raw enabledProcessors list is present, that
 * is honored and the capabilities are derived from it.
 */
async function handleStart(
  config: TaskCenterConfig | undefined,
  sendResponse: (response: any) => void,
) {
  const startEpoch = runtimeEpoch;
  if (!config || !config.apiUrl) {
    sendResponse({ success: false, error: 'Config with apiUrl is required to start Task Center' });
    return;
  }
  // startAll indexes config.processors[type]; default it so a popup that sends
  // only apiUrl + activeCapabilities doesn't trip on an undefined map.
  if (!config.processors) config.processors = {};

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
  await setRunIntent({ running: true, activeCapabilities, apiUrl: config.apiUrl });
  await persistTaskCenterRuntime(true, config);

  sendResponse({
    success: true,
    message: 'Task Center started',
    status: await buildFullStatus(),
  });
}

/**
 * Move every active lane to a new shared API endpoint without mixing task
 * ownership across backends. stop() lets an already-claimed task finish on its
 * original client; each processor's next start waits for that cycle to settle.
 * A failed new start restores the last known-good runtime.
 */
async function handleReconfigure(
  config: TaskCenterConfig | undefined,
  sendResponse: (response: any) => void,
): Promise<void> {
  if (!config?.apiUrl) {
    sendResponse({ success: false, error: 'Running configuration with apiUrl is required' });
    return;
  }

  const previousIntent = await getRunIntent();
  const previousConfig = lastStartConfig
    ? {
        ...lastStartConfig,
        processors: { ...(lastStartConfig.processors || {}) },
        activeCapabilities: previousIntent.activeCapabilities,
        enabledProcessors: processorsForCapabilities(previousIntent.activeCapabilities),
      }
    : null;

  taskCenter.stopAll();

  try {
    await handleStart(config, sendResponse);
  } catch (error) {
    if (previousConfig?.apiUrl && previousIntent.running) {
      try {
        await handleStart(previousConfig, () => undefined);
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
  config: TaskCenterConfig | undefined,
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
    sendResponse({ success: false, error: 'Start Task Center before changing capabilities' });
    return;
  }
  const capSet = new Set(intent.activeCapabilities);
  if (enabled) capSet.add(capability);
  else capSet.delete(capability);
  const activeCapabilities = Array.from(capSet);

  // Reuse the complete last/start config so live toggles keep each processor's
  // persisted batch, interval, language, and parallelism settings.
  const effectiveConfig = config || lastStartConfig;
  const apiUrl = (effectiveConfig?.apiUrl || '').trim();
  if (!apiUrl) {
    sendResponse({ success: false, error: 'apiUrl is required to change capabilities' });
    return;
  }

  const previousProcessors = processorsForCapabilities(intent.activeCapabilities);
  const enabledProcessors = processorsForCapabilities(activeCapabilities);
  const baseConfig = lastStartConfig || effectiveConfig || { apiUrl };
  const previousConfig: TaskCenterConfig = {
    ...baseConfig,
    apiUrl,
    processors: { ...(baseConfig.processors || {}) },
    activeCapabilities: [...intent.activeCapabilities],
    enabledProcessors: previousProcessors,
  };
  const nextConfig: TaskCenterConfig = {
    ...baseConfig,
    ...(effectiveConfig || {}),
    apiUrl,
    processors: {
      ...(baseConfig.processors || {}),
      ...(effectiveConfig?.processors || {}),
    },
    activeCapabilities,
    enabledProcessors,
  };

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
  await setRunIntent({ running: true, activeCapabilities, apiUrl: nextConfig.apiUrl });
  await persistTaskCenterRuntime(true, nextConfig);

  sendResponse({ success: true, status: await buildFullStatus() });
}
