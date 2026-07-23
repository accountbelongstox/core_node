/**
 * Task Center Message Listener
 * Handles messages from popup to control the unified task center
 * Under 320 lines
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

/**
 * Last successful start config, so a live `set_capability` toggle can start a
 * lane with the same apiUrl the user started with (no full restart needed).
 */
let lastStartConfig: TaskCenterConfig | null = null;

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
    isRunning: status.isRunning || validity.running || (
      intent.running && intent.activeCapabilities.length > 0
    ),
    validity,
    activeCapabilities: intent.activeCapabilities,
  };
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
  message: { type: string; action: string; config?: ValidityRunnerConfig },
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
        await handleStart(message.config, sendResponse);
        break;
      }

      case 'stop': {
        taskCenter.stopAll();
        wordValidityRunnerService.stop();
        // Belt-and-suspenders: force-clear the Bing watchdog + session run-intent
        // so the crawler can NEVER resurrect after Stop (even if its processor
        // was not running in this SW instance).
        await bingDictionaryWorkerService.stopAndClear();
        await clearRunIntent();
        lastStartConfig = null;
        sendResponse({
          success: true,
          message: 'Task Center stopped',
          status: await buildFullStatus(),
        });
        break;
      }

      case 'set_capability': {
        await handleSetCapability(message.capability, message.enabled === true, message.config, sendResponse);
        break;
      }

      case 'get_status': {
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
  if (enabledProcessors.length > 0) {
    await taskCenter.startAll(config);
  }

  // Start the client-driven validity runner when a validity-runner capability is
  // active (independent of the global-task lane).
  if (usesValidity) {
    await wordValidityRunnerService.start({ apiUrl: config.apiUrl });
  }

  lastStartConfig = config;
  await setRunIntent({ running: true, activeCapabilities });

  sendResponse({
    success: true,
    message: 'Task Center started',
    status: await buildFullStatus(),
  });
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
    if (def.processors.length > 0 && !apiUrl) {
      sendResponse({
        success: false,
        error: 'apiUrl required to start a capability (start Task Center first or pass config.apiUrl)',
      });
      return;
    }
    for (const p of def.processors) {
      const processorConfig = effectiveConfig?.processors?.[p] || { apiUrl };
      taskCenter.enableProcessor(p);
      await taskCenter.startProcessor(p, { ...processorConfig, apiUrl });
    }
    if (def.usesValidityRunner) {
      await wordValidityRunnerService.start({ apiUrl });
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
      capability === 'bing' &&
      !activeCapabilities.some((key) =>
        CAPABILITY_BY_KEY[key]?.processors.includes(LANES.BING_DICTIONARY),
      )
    ) {
      // Ensure the Bing watchdog + session run-intent are cleared so the crawler
      // cannot resurrect after being toggled off.
      await bingDictionaryWorkerService.stopAndClear();
    }
  }

  // Update run-intent's active set; running is true while >=1 capability active.
  await setRunIntent({ running: activeCapabilities.length > 0, activeCapabilities });

  sendResponse({ success: true, status: await buildFullStatus() });
}
