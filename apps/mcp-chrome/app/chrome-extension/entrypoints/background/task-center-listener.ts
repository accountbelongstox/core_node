/**
 * Task Center Message Listener
 * Handles messages from popup to control the unified task center
 */

import { taskCenter, type TaskCenterConfig } from './services/task-center/TaskCenter';
import {
  wordValidityRunnerService,
  type ValidityRunnerConfig,
} from './services/word-validity/word-validity-runner-service';
import { bingDictionaryWorkerService } from './services/bing-dictionary-worker-service';
import {
  getRunIntent,
  setRunIntent,
  clearRunIntent,
} from './services/task-center/run-intent';
import {
  CAPABILITY_BY_KEY,
  capabilityForProcessor,
  processorsForCapabilities,
  type CapabilityKey,
} from '@/utils/task-capabilities';
import {
  TASK_CENTER_MSG,
  VALIDITY_RUNNER_MSG,
  SUBMIT_OUTBOX_MSG,
  type FullTaskCenterStatus,
} from '@/utils/task-center-types';
import { submitOutbox } from './services/outbox/submit-outbox';
import { LANES } from '@/utils/task-center-lanes';
import { runWordValidityClassification } from './services/word-validity/word-validity-web-runtime';
import type { AiWebProvider } from './tools/browser/ai-web-common';
import { STORAGE_KEYS } from '@/utils/storage-keys';

interface PersistedTaskCenterRuntime {
  running: boolean;
  config: (TaskCenterConfig & { activeCapabilities?: CapabilityKey[] }) | null;
}

const TASK_CENTER_RUNTIME_KEY = STORAGE_KEYS.TASK_CENTER_RUNTIME;
const TASK_CENTER_WATCHDOG_ALARM = STORAGE_KEYS.TASK_CENTER_WATCHDOG_ALARM;
const BING_WATCHDOG_ALARM = STORAGE_KEYS.BING_WATCHDOG_ALARM;
const WATCHDOG_PERIOD_MINUTES = 1;

/**
 * Last successful start config, so a live `set_capability` toggle can start a
 * lane with the same apiUrl the user started with (no full restart needed).
 */
let lastStartConfig: TaskCenterConfig | null = null;
let restoreInFlight: Promise<void> | null = null;
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
    if (message.type === VALIDITY_RUNNER_MSG) {
      handleValidityRunnerMessage(message, sendResponse);
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
 * validity runner status + the persisted active capabilities (run-intent).
 */
async function buildFullStatus(): Promise<FullTaskCenterStatus> {
  const status = taskCenter.getStatus(); // { isRunning, stats, backend }
  const intent = await getRunIntent();
  const validity = wordValidityRunnerService.getStatus();
  return {
    ...status,
    isRunning: status.isRunning || validity.running,
    activeApiUrl: lastStartConfig?.apiUrl || null,
    validity,
    activeCapabilities: intent.activeCapabilities,
  };
}

async function persistTaskCenterRuntime(
  running: boolean,
  config: (TaskCenterConfig & { activeCapabilities?: CapabilityKey[] }) | null,
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
    await bingDictionaryWorkerService.stopAndClear();
    return;
  }
  if (!runtime?.running || !runtime.config?.apiUrl) {
    await persistTaskCenterRuntime(false, null);
    await bingDictionaryWorkerService.resume();
    return;
  }

  const activeCapabilities = sanitizeCapabilities(intent.activeCapabilities);
  const enabledProcessors = processorsForCapabilities(activeCapabilities);
  const usesValidity = activeCapabilities.some((key) => CAPABILITY_BY_KEY[key]?.usesValidityRunner);
  if (enabledProcessors.length === 0 && !usesValidity) return;

  const processors = { ...(runtime.config.processors || {}) };
  processors[LANES.BING_DICTIONARY] = {
    ...(processors[LANES.BING_DICTIONARY] || { apiUrl: runtime.config.apiUrl }),
    apiUrl: runtime.config.apiUrl,
    surface: false,
  };
  const config = {
    ...runtime.config,
    processors,
    activeCapabilities,
    enabledProcessors,
  };
  const centerWasRunning = taskCenter.isTaskCenterRunning();
  const validityWasRunning = wordValidityRunnerService.getStatus().running;
  let centerStarted = false;
  let validityStarted = false;

  try {
    if (enabledProcessors.length > 0 && !centerWasRunning) {
      await taskCenter.startAll(config);
      centerStarted = true;
    }
    if (restoreEpoch !== runtimeEpoch) {
      if (centerStarted) taskCenter.stopAll();
      return;
    }
    if (usesValidity && !validityWasRunning) {
      await wordValidityRunnerService.start({ apiUrl: config.apiUrl });
      validityStarted = true;
    }
    if (restoreEpoch !== runtimeEpoch) {
      if (validityStarted) wordValidityRunnerService.stop();
      if (centerStarted) taskCenter.stopAll();
      return;
    }
    lastStartConfig = config;
    await persistTaskCenterRuntime(true, config);
    if (restoreEpoch !== runtimeEpoch) {
      if (validityStarted) wordValidityRunnerService.stop();
      if (centerStarted) taskCenter.stopAll();
      if (lastStartConfig === config) lastStartConfig = null;
      return;
    }
    console.log('[Task Center] Restored active processors after service-worker restart');
  } catch (error) {
    if (validityStarted) wordValidityRunnerService.stop();
    if (centerStarted) taskCenter.stopAll();
    console.error('[Task Center] Runtime restore failed:', error);
  }
}

export function restoreTaskCenterRuntime(): Promise<void> {
  if (!restoreInFlight) {
    restoreInFlight = lifecycleQueue
      .then(() => performRuntimeRestore())
      .catch((error) => {
        console.error('[Task Center] Runtime restore failed:', error);
      })
      .finally(() => {
        restoreInFlight = null;
      });
  }
  return restoreInFlight;
}

async function runLifecycleAction(action: () => Promise<void>): Promise<void> {
  const pendingRestore = restoreInFlight;
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
  wordValidityRunnerService.stop();
  // Belt-and-suspenders: force-clear the Bing watchdog + session run-intent
  // so the crawler can NEVER resurrect after Stop (even if its processor
  // was not running in this SW instance).
  await bingDictionaryWorkerService.stopAndClear();
  await clearRunIntent();
  await persistTaskCenterRuntime(false, null);
  lastStartConfig = null;
  sendResponse({
    success: true,
    message: 'Task Center stopped',
    status: await buildFullStatus(),
  });
}

/** Back-compat: derive capability keys from a raw processorType allowlist. */
function capabilitiesFromProcessors(processors: string[]): CapabilityKey[] {
  const set = new Set<CapabilityKey>();
  for (const p of processors) {
    const cap = capabilityForProcessor(p);
    if (cap) set.add(cap);
  }
  return Array.from(set);
}

/** Filter an arbitrary array down to known CapabilityKeys. */
function sanitizeCapabilities(raw: unknown): CapabilityKey[] {
  if (!Array.isArray(raw)) return [];
  const out: CapabilityKey[] = [];
  for (const k of raw) {
    if (typeof k === 'string' && (k as CapabilityKey) in CAPABILITY_BY_KEY) {
      out.push(k as CapabilityKey);
    }
  }
  return out;
}

/**
 * Handle client-driven Word-Validity Runner messages (independent of the
 * global-task lane). Actions: start / stop / status.
 */
async function handleValidityRunnerMessage(
  message: {
    type: string;
    action: string;
    config?: ValidityRunnerConfig;
    words?: string[];
    provider?: AiWebProvider;
  },
  sendResponse: (response: any) => void,
) {
  try {
    switch (message.action) {
      case 'start': {
        await wordValidityRunnerService.start(message.config || {});
        sendResponse({ success: true, status: wordValidityRunnerService.getStatus() });
        break;
      }
      case 'stop': {
        wordValidityRunnerService.stop();
        sendResponse({ success: true, status: wordValidityRunnerService.getStatus() });
        break;
      }
      case 'status': {
        sendResponse({ success: true, status: wordValidityRunnerService.getStatus() });
        break;
      }
      case 'test': {
        const words = Array.isArray(message.words)
          ? message.words
              .map((word) => String(word).trim())
              .filter(Boolean)
              .map((word) => ({ word }))
          : [];
        if (words.length === 0) {
          sendResponse({ success: false, error: 'Enter at least one word' });
          break;
        }
        const result = await runWordValidityClassification(words, message.provider);
        sendResponse({ success: true, result });
        break;
      }
      default: {
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      }
    }
  } catch (error: any) {
    console.error('[Validity Runner] Error:', error);
    sendResponse({ success: false, error: error?.message || 'Unknown error' });
  }
}

/**
 * Handle Task Center messages
 */
async function handleTaskCenterMessage(
  message: {
    type: string;
    action: string;
    config?: TaskCenterConfig & { activeCapabilities?: CapabilityKey[] };
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
        if (restoreInFlight) await restoreInFlight;
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

/**
 * Start assist. `config.activeCapabilities` (from the popup checkboxes) is the
 * authoritative allowlist: it is translated to the TaskCenter processor
 * allowlist via the shared catalog and persisted as run-intent. Back-compat: if
 * activeCapabilities is absent but a raw enabledProcessors list is present, that
 * is honored and the capabilities are derived from it.
 */
async function handleStart(
  config: (TaskCenterConfig & { activeCapabilities?: CapabilityKey[] }) | undefined,
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
  let activeCapabilities = sanitizeCapabilities(config.activeCapabilities);
  let enabledProcessors: string[];
  if (activeCapabilities.length > 0) {
    enabledProcessors = processorsForCapabilities(activeCapabilities);
  } else if (Array.isArray(config.enabledProcessors)) {
    enabledProcessors = config.enabledProcessors;
    activeCapabilities = capabilitiesFromProcessors(enabledProcessors);
  } else {
    enabledProcessors = [];
  }
  config.enabledProcessors = enabledProcessors;

  const usesValidity = activeCapabilities.some((k) => CAPABILITY_BY_KEY[k]?.usesValidityRunner);

  // Reject an empty selection instead of persisting a misleading running state.
  if (enabledProcessors.length === 0 && !usesValidity) {
    sendResponse({
      success: false,
      error: 'Select at least one task capability before starting Task Center',
    });
    return;
  }

  // Start the task-center lanes (skip when only the validity runner is active).
  const centerWasRunning = taskCenter.isTaskCenterRunning();
  const validityWasRunning = wordValidityRunnerService.getStatus().running;
  try {
    if (enabledProcessors.length > 0) {
      await taskCenter.startAll(config);
    }

    // Start the client-driven validity runner when a validity-runner capability is
    // active (independent of the global-task lane).
    if (usesValidity) {
      await wordValidityRunnerService.start({ apiUrl: config.apiUrl });
    }
  } catch (error) {
    if (!validityWasRunning) wordValidityRunnerService.stop();
    if (!centerWasRunning) taskCenter.stopAll();
    throw error;
  }

  // A Stop landed while the lanes were starting — roll back instead of
  // resurrecting a running state the user already cancelled (d.txt 6.2.2).
  if (startEpoch !== runtimeEpoch) {
    wordValidityRunnerService.stop();
    taskCenter.stopAll();
    sendResponse({ success: false, error: 'Start superseded by Stop' });
    return;
  }

  lastStartConfig = config;
  await setRunIntent({ running: true, activeCapabilities });
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
  config: (TaskCenterConfig & { activeCapabilities?: CapabilityKey[] }) | undefined,
  sendResponse: (response: any) => void,
): Promise<void> {
  const activeCapabilities = sanitizeCapabilities(config?.activeCapabilities);
  if (!config?.apiUrl || activeCapabilities.length === 0) {
    sendResponse({ success: false, error: 'Running configuration with active capabilities is required' });
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
  wordValidityRunnerService.stop();

  try {
    await handleStart(config, sendResponse);
  } catch (error) {
    if (previousConfig?.apiUrl && previousIntent.activeCapabilities.length > 0) {
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
  config: (TaskCenterConfig & { activeCapabilities?: CapabilityKey[] }) | undefined,
  sendResponse: (response: any) => void,
) {
  if (!capability || !(capability in CAPABILITY_BY_KEY)) {
    sendResponse({ success: false, error: `Unknown capability: ${capability}` });
    return;
  }
  const capEpoch = runtimeEpoch;
  const def = CAPABILITY_BY_KEY[capability];
  const intent = await getRunIntent();
  const capSet = new Set(intent.activeCapabilities);
  if (enabled) capSet.add(capability);
  else capSet.delete(capability);
  const activeCapabilities = Array.from(capSet);

  // Reuse the complete last/start config so live toggles keep each processor's
  // persisted batch, interval, language, and parallelism settings.
  const effectiveConfig = config || lastStartConfig;
  const apiUrl = (effectiveConfig?.apiUrl || '').trim();

  if (enabled) {
    if ((def.processors.length > 0 || def.usesValidityRunner) && !apiUrl) {
      sendResponse({
        success: false,
        error: 'apiUrl required to start a capability (start Task Center first or pass config.apiUrl)',
      });
      return;
    }
    const startedProcessors: string[] = [];
    try {
      if (!taskCenter.isTaskCenterRunning()) {
        // Runner-only selection (e.g. validity): an EMPTY lane allowlist must
        // NOT hit startAll — startAll treats absent/empty as "keep current
        // per-processor state" and would light up every default-enabled lane.
        const laneAllow = processorsForCapabilities(activeCapabilities);
        if (laneAllow.length > 0) {
          await taskCenter.startAll({
            ...(effectiveConfig || { apiUrl }),
            apiUrl,
            activeCapabilities,
            enabledProcessors: laneAllow,
          });
        }
      } else {
        for (const p of def.processors) {
          const processorConfig = effectiveConfig?.processors?.[p] || { apiUrl };
          const wasRunning = taskCenter.getProcessorStatus(p)?.isRunning === true;
          taskCenter.enableProcessor(p);
          try {
            await taskCenter.startProcessor(p, { ...processorConfig, apiUrl });
          } catch (error) {
            if (!wasRunning) taskCenter.disableProcessor(p);
            throw error;
          }
          if (!wasRunning) startedProcessors.push(p);
        }
      }
      if (def.usesValidityRunner) {
        await wordValidityRunnerService.start({ apiUrl });
      }
    } catch (error: any) {
      for (const processorType of startedProcessors.reverse()) {
        taskCenter.disableProcessor(processorType);
      }
      sendResponse({
        success: false,
        error: error?.message || `Failed to start capability: ${capability}`,
      });
      return;
    }
    // Remember the apiUrl so a later toggle can start more lanes.
    if (apiUrl) {
      lastStartConfig = {
        ...(lastStartConfig || {}),
        ...(effectiveConfig || {}),
        apiUrl,
        processors: {
          ...(lastStartConfig?.processors || {}),
          ...(effectiveConfig?.processors || {}),
        },
      };
    }
  } else {
    for (const p of def.processors) {
      const stillNeeded = activeCapabilities.some((key) =>
        CAPABILITY_BY_KEY[key]?.processors.includes(p),
      );
      if (!stillNeeded) {
        taskCenter.disableProcessor(p);
      }
    }
    if (def.usesValidityRunner) {
      wordValidityRunnerService.stop();
    }
    if (
      def.processors.includes(LANES.BING_DICTIONARY) &&
      !activeCapabilities.some((key) =>
        CAPABILITY_BY_KEY[key]?.processors.includes(LANES.BING_DICTIONARY),
      )
    ) {
      // Ensure the Bing watchdog + session run-intent are cleared so the crawler
      // cannot resurrect after being toggled off.
      await bingDictionaryWorkerService.stopAndClear();
    }
  }

  if (activeCapabilities.length === 0 && taskCenter.isTaskCenterRunning()) {
    taskCenter.stopAll();
    lastStartConfig = null;
  }

  // A Stop landed mid-toggle — do not resurrect run-intent (d.txt 6.2.2).
  if (capEpoch !== runtimeEpoch) {
    sendResponse({ success: false, error: 'Capability change superseded by Stop' });
    return;
  }

  // Update run-intent's active set; running is true while >=1 capability active.
  await setRunIntent({ running: activeCapabilities.length > 0, activeCapabilities });
  if (activeCapabilities.length > 0) {
    const baseConfig = lastStartConfig || effectiveConfig;
    lastStartConfig = {
      ...(baseConfig || { apiUrl }),
      apiUrl,
      processors: {
        ...(baseConfig?.processors || {}),
        ...(effectiveConfig?.processors || {}),
      },
      activeCapabilities,
      enabledProcessors: processorsForCapabilities(activeCapabilities),
    };
    await persistTaskCenterRuntime(true, lastStartConfig);
  } else {
    await persistTaskCenterRuntime(false, null);
  }

  sendResponse({ success: true, status: await buildFullStatus() });
}
