// Audio Recording Tool Handlers
// Manages audio recording via offscreen documents and tab capture

// Firefox provides neither chrome.tabCapture nor offscreen documents, so the
// whole audio capture feature is unavailable there
export const FIREFOX_AUDIO_UNSUPPORTED_ERROR =
  'Audio recording is not supported on Firefox: chrome.tabCapture and offscreen documents are unavailable.';

interface AudioConfig {
  tabId?: number;
  includeMicrophone?: boolean;
  saveLocal?: boolean;
  maxDuration?: number;
  autoStopOnSilence?: boolean;
  silenceDuration?: number;
  apiServers?: Array<{
    id: string;
    name: string;
    url: string;
    authToken: string;
    streamingMode: 'realtime' | 'chunks' | 'file';
    chunkInterval: number;
    enabled: boolean;
  }>;
  sessionMetadata?: Record<string, string | number | boolean>;
}

interface AudioStatus {
  isRecording: boolean;
  duration: number;
  chunkCount: number;
}

// Track current recording state
let currentRecordingStatus: AudioStatus = {
  isRecording: false,
  duration: 0,
  chunkCount: 0,
};

// Wall-clock time the current recording started, captured in the background so
// handleAudioStop can recompute an accurate final duration. The offscreen's
// periodic 1s status tick floors duration and is up to ~1s stale by stop time.
let recordingStartTime: number | null = null;

// Track background streaming state
let backgroundStreamingEnabled = false;

type ApiServerConfig = {
  id: string;
  name: string;
  url: string;
  authToken?: string;
  streamingMode: 'realtime' | 'chunks' | 'file';
  chunkInterval?: number;
  enabled?: boolean;
};

function normalizeApiServers(servers: ApiServerConfig[] = []) {
  return servers
    .filter((server) => server.enabled !== false)
    .map((server) => ({
      ...server,
      chunkInterval: server.chunkInterval ?? 1000,
      enabled: true,
    }));
}

/**
 * Handle chrome_audio_start tool request
 */
export async function handleAudioStart(params: AudioConfig): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    if (import.meta.env.FIREFOX) {
      return { success: false, error: FIREFOX_AUDIO_UNSUPPORTED_ERROR };
    }

    console.log('[Audio Tools] Starting audio recording with params:', params);

    // Check if already recording
    if (currentRecordingStatus.isRecording) {
      return {
        success: false,
        error: 'Audio recording already in progress. Stop current recording first.',
      };
    }

    // Get target tab
    let targetTab;
    if (params.tabId) {
      targetTab = await chrome.tabs.get(params.tabId);
    } else {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      targetTab = activeTab;
    }

    if (!targetTab) {
      return {
        success: false,
        error: 'No valid tab found for recording',
      };
    }

    // Check if tab is recordable
    if (
      targetTab.url?.startsWith('chrome://') ||
      targetTab.url?.startsWith('chrome-extension://')
    ) {
      return {
        success: false,
        error: 'Cannot record Chrome system pages or extension pages',
      };
    }

    // Ensure offscreen document exists
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (!hasOffscreen) {
      console.log('[Audio Tools] Creating offscreen document');
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen/audio-recorder.html'),
        reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
        justification: 'Audio recording for MCP tools and API streaming',
      });

      // Wait a bit for offscreen to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Get stream ID for tab capture
    console.log('[Audio Tools] Getting media stream ID for tab:', targetTab.id);
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: targetTab.id,
    });

    // Load audio config from storage or use defaults
    const storedConfig = await chrome.storage.local.get(['audioRecordingConfig']);
    const audioConfig = storedConfig.audioRecordingConfig || {};

    // Merge with MCP params
    const selectedServers = (params.apiServers?.length ? params.apiServers : audioConfig.apiServers) || [];
    const finalConfig = {
      apiServers: normalizeApiServers(selectedServers),
      recordingSettings: {
        includeMicrophone: params.includeMicrophone !== false,
        saveLocal: params.saveLocal || false,
        enableAutoStop: params.autoStopOnSilence || false,
        silenceDuration: params.silenceDuration || 30,
        maxDuration: params.maxDuration || 0,
        ...(audioConfig.recordingSettings || {}),
      },
      sessionMetadata: params.sessionMetadata ?? audioConfig.sessionMetadata ?? {},
    };

    // Override with MCP params if provided
    if (params.includeMicrophone !== undefined) {
      finalConfig.recordingSettings.includeMicrophone = params.includeMicrophone;
    }
    if (params.saveLocal !== undefined) {
      finalConfig.recordingSettings.saveLocal = params.saveLocal;
    }
    if (params.autoStopOnSilence !== undefined) {
      finalConfig.recordingSettings.enableAutoStop = params.autoStopOnSilence;
    }
    if (params.silenceDuration !== undefined) {
      finalConfig.recordingSettings.silenceDuration = params.silenceDuration;
    }
    if (params.maxDuration !== undefined) {
      finalConfig.recordingSettings.maxDuration = params.maxDuration;
    }

    console.log('[Audio Tools] Sending recording config to offscreen:', finalConfig);

    // Send start recording message to offscreen
    const response = await chrome.runtime.sendMessage({
      type: 'audio_start_recording',
      streamId,
      config: finalConfig,
    });

    if (response && response.success !== false) {
      currentRecordingStatus.isRecording = true;
      currentRecordingStatus.duration = 0;
      currentRecordingStatus.chunkCount = 0;
      recordingStartTime = Date.now();

      return {
        success: true,
        data: {
          recording: true,
          tabId: targetTab.id,
          tabTitle: targetTab.title,
          config: finalConfig.recordingSettings,
        },
      };
    } else {
      return {
        success: false,
        error: response?.error || 'Failed to start recording in offscreen document',
      };
    }
  } catch (error: any) {
    console.error('[Audio Tools] Error starting recording:', error);
    return {
      success: false,
      error: error.message || 'Unknown error starting recording',
    };
  }
}

/**
 * Wait briefly for the offscreen's final recording-status update after a stop.
 * The offscreen's stopRecording responds before the final MediaRecorder
 * ondataavailable (which carries the last chunk) fires, so the periodic status
 * tick is stale by up to 1s and may miss the final chunk. The first post-stop
 * status update carries isRecording=false and the final chunkCount; resolve on
 * it, falling back to the last known status after timeoutMs.
 */
function waitForFinalRecordingStatus(timeoutMs: number): Promise<AudioStatus> {
  return new Promise((resolve) => {
    const baselineChunks = currentRecordingStatus.chunkCount;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = (message: any) => {
      if (message?.type !== 'audio_recording_status_update') return;
      const status = message.status as AudioStatus;
      if (!status.isRecording || status.chunkCount > baselineChunks) {
        if (timer) clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(status);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      resolve({ ...currentRecordingStatus });
    }, timeoutMs);
  });
}

/**
 * Handle chrome_audio_stop tool request
 */
export async function handleAudioStop(params?: {
  returnData?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    if (import.meta.env.FIREFOX) {
      return { success: false, error: FIREFOX_AUDIO_UNSUPPORTED_ERROR };
    }

    console.log('[Audio Tools] Stopping audio recording');

    if (!currentRecordingStatus.isRecording) {
      return {
        success: false,
        error: 'No active recording to stop',
      };
    }

    // Send stop message to offscreen
    const response = await chrome.runtime.sendMessage({
      type: 'audio_stop_recording',
    });

    if (response && response.success !== false) {
      // The offscreen's stopRecording responds before the final MediaRecorder
      // ondataavailable fires, so the periodic status tick backing
      // currentRecordingStatus is stale by up to 1s and may miss the final
      // chunk. Wait briefly for the offscreen's final status update before
      // snapshotting chunkCount, and recompute duration from the start time.
      const finalStatus = await waitForFinalRecordingStatus(1500);
      const finalDuration =
        recordingStartTime !== null
          ? Math.floor((Date.now() - recordingStartTime) / 1000)
          : finalStatus.duration;
      currentRecordingStatus.isRecording = false;
      currentRecordingStatus.duration = 0;
      currentRecordingStatus.chunkCount = 0;
      recordingStartTime = null;

      return {
        success: true,
        data: {
          stopped: true,
          finalDuration,
          totalChunks: finalStatus.chunkCount,
        },
      };
    } else {
      return {
        success: false,
        error: response?.error || 'Failed to stop recording',
      };
    }
  } catch (error: any) {
    console.error('[Audio Tools] Error stopping recording:', error);
    return {
      success: false,
      error: error.message || 'Unknown error stopping recording',
    };
  }
}

/**
 * Handle chrome_audio_status tool request
 */
export async function handleAudioStatus(): Promise<{
  success: boolean;
  error?: string;
  status?: any;
}> {
  try {
    return {
      success: true,
      status: {
        isRecording: currentRecordingStatus.isRecording,
        duration: currentRecordingStatus.duration,
        chunkCount: currentRecordingStatus.chunkCount,
        backgroundStreaming: backgroundStreamingEnabled,
      },
    };
  } catch (error: any) {
    console.error('[Audio Tools] Error getting status:', error);
    return {
      success: false,
      error: error.message || 'Unknown error getting status',
    };
  }
}

/**
 * Handle chrome_audio_duration tool request
 */
export async function handleAudioDuration(): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    return {
      success: true,
      data: {
        duration: currentRecordingStatus.duration,
        isRecording: currentRecordingStatus.isRecording,
      },
    };
  } catch (error: any) {
    console.error('[Audio Tools] Error getting duration:', error);
    return {
      success: false,
      error: error.message || 'Unknown error getting duration',
    };
  }
}

/**
 * Handle background streaming toggle from popup
 */
export async function handleBackgroundStreamingToggle(params: {
  enabled: boolean;
  config: any;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('[Audio Tools] Toggling background streaming:', params.enabled);

    if (params.enabled) {
      // Start background streaming
      const result = await handleAudioStart({
        includeMicrophone: params.config.recordingSettings?.includeMicrophone,
        saveLocal: false, // Background streaming doesn't save locally by default
        maxDuration: 0, // No duration limit for background streaming
        autoStopOnSilence: false, // Don't auto-stop for background streaming
        apiServers: params.config.apiServers,
        sessionMetadata: params.config.sessionMetadata,
      });

      if (result.success) {
        backgroundStreamingEnabled = true;
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } else {
      // Stop background streaming
      const result = await handleAudioStop();
      backgroundStreamingEnabled = false;

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    }
  } catch (error: any) {
    console.error('[Audio Tools] Error toggling background streaming:', error);
    return {
      success: false,
      error: error.message || 'Unknown error toggling background streaming',
    };
  }
}

/**
 * Update recording status from offscreen document
 */
export function updateRecordingStatus(status: AudioStatus) {
  currentRecordingStatus = status;

  // Broadcast status to popup
  chrome.runtime.sendMessage({
    type: 'audio_recording_status_update',
    status: currentRecordingStatus,
  }).catch(() => {
    // Popup might be closed, ignore error
  });
}

/**
 * Run an async handler and forward the resolved value (or error) to
 * sendResponse, keeping the Chrome message channel open via the `true`
 * return value the caller must propagate.
 */
function respondAsync(
  sendResponse: (response?: any) => void,
  promise: Promise<any>,
): true {
  promise
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
}

/**
 * Setup audio recording status listener and popup message handlers
 */
export function setupAudioStatusListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle status updates from offscreen
    if (message.type === 'audio_recording_status_update') {
      updateRecordingStatus(message.status);
      return;
    }

    // Handle messages from popup
    if (message.type === 'audio_start_recording') {
      return respondAsync(sendResponse, handleAudioStart(message.config));
    }

    if (message.type === 'audio_stop_recording') {
      return respondAsync(sendResponse, handleAudioStop());
    }

    if (message.type === 'audio_toggle_background_streaming') {
      return respondAsync(sendResponse, handleBackgroundStreamingToggle(message));
    }

    if (message.type === 'audio_get_recording_status') {
      return respondAsync(sendResponse, handleAudioStatus());
    }
  });
}

/**
 * Cleanup offscreen document on extension shutdown
 */
export async function cleanupAudioResources() {
  if (import.meta.env.FIREFOX) {
    // No offscreen documents exist on Firefox; nothing to clean up
    return;
  }

  try {
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (hasOffscreen) {
      console.log('[Audio Tools] Closing offscreen document');
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error('[Audio Tools] Error cleaning up audio resources:', error);
  }
}
