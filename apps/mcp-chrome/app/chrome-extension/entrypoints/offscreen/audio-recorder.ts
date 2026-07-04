// Offscreen Audio Recorder
// Handles audio capture, mixing, streaming, and silence detection

// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';

let recorder: MediaRecorder | null = null;
let audioData: Blob[] = [];
let activeStreams: MediaStream[] = [];
let websockets: Map<string, WebSocket> = new Map();
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let silenceDetectionInterval: ReturnType<typeof setInterval> | null = null;

// Recording configuration
let recordingConfig: {
  apiServers: Array<{
    id: string;
    name: string;
    url: string;
    authToken: string;
    streamingMode: 'realtime' | 'chunks' | 'file';
    chunkInterval: number;
    enabled: boolean;
  }>;
  recordingSettings: {
    includeMicrophone: boolean;
    saveLocal: boolean;
    enableAutoStop: boolean;
    silenceDuration: number;
    maxDuration: number;
  };
  sessionMetadata?: Record<string, string | number | boolean>;
} | null = null;

// Recording state
let recordingState = {
  isRecording: false,
  startTime: 0,
  duration: 0,
  chunkCount: 0,
  silenceStartTime: 0,
  isSilent: false,
};

// Message listener
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('[Audio Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'audio_start_recording':
      await startRecording(message.streamId, message.config);
      sendResponse({ success: true });
      break;

    case 'audio_stop_recording':
      await stopRecording();
      sendResponse({ success: true });
      break;

    case 'audio_update_config':
      recordingConfig = message.config;
      sendResponse({ success: true });
      break;

    default:
      console.warn('[Audio Offscreen] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep message channel open for async response
});

async function startRecording(streamId: string, config: typeof recordingConfig) {
  if (recorder?.state === 'recording') {
    console.warn('[Audio Offscreen] Recording already in progress');
    throw new Error('Recording already in progress');
  }

  console.log('[Audio Offscreen] Starting recording with config:', config);
  recordingConfig = config;
  audioData = [];
  recordingState = {
    isRecording: true,
    startTime: Date.now(),
    duration: 0,
    chunkCount: 0,
    silenceStartTime: 0,
    isSilent: false,
  };

  try {
    // Stop any existing streams
    await stopAllStreams();

    // Connect to WebSocket servers if needed
    await connectWebSockets();

    // Get tab audio stream
    const tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        } as any,
      },
      video: false,
    });
    activeStreams.push(tabStream);

    // Create audio context for mixing and analysis
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Create analyser for silence detection
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;

    // Tab audio source
    const tabSource = audioContext.createMediaStreamSource(tabStream);
    const tabGain = audioContext.createGain();
    tabGain.gain.value = 1.0;

    // Connect tab audio
    tabSource.connect(tabGain);
    tabGain.connect(destination);
    tabGain.connect(analyserNode);

    // Get microphone stream if enabled
    if (recordingConfig?.recordingSettings.includeMicrophone) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        activeStreams.push(micStream);

        const micSource = audioContext.createMediaStreamSource(micStream);
        const micGain = audioContext.createGain();
        micGain.gain.value = 1.5; // Boost microphone slightly

        micSource.connect(micGain);
        micGain.connect(destination);
        micGain.connect(analyserNode);

        console.log('[Audio Offscreen] Microphone included in recording');
      } catch (micError) {
        console.warn('[Audio Offscreen] Microphone not available:', micError);
      }
    }

    // Create media recorder
    const chunkInterval = recordingConfig?.apiServers.find(
      s => s.streamingMode === 'chunks'
    )?.chunkInterval || 1000;

    recorder = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm',
    });

    // Handle data available
    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        recordingState.chunkCount++;

        // Stream to API servers
        await streamChunk(event.data);

        // Save locally if enabled
        if (recordingConfig?.recordingSettings.saveLocal !== false) {
          audioData.push(event.data);
        }

        // Update status
        notifyRecordingStatus();
      }
    };

    // Handle stop
    recorder.onstop = async () => {
      console.log('[Audio Offscreen] Recording stopped');

      // Upload complete file if needed
      if (audioData.length > 0) {
        await uploadCompleteFile();
      }

      // Cleanup
      await cleanup();
    };

    // Start recording with specified interval
    recorder.start(chunkInterval);
    console.log('[Audio Offscreen] Recording started');

    // Start silence detection if enabled
    if (recordingConfig?.recordingSettings.enableAutoStop) {
      startSilenceDetection();
    }

    // Start duration timer
    startDurationTimer();

    // Set max duration timeout if configured
    if (recordingConfig?.recordingSettings.maxDuration &&
        recordingConfig.recordingSettings.maxDuration > 0) {
      setTimeout(() => {
        if (recordingState.isRecording) {
          console.log('[Audio Offscreen] Max duration reached, stopping recording');
          stopRecording();
        }
      }, recordingConfig.recordingSettings.maxDuration * 1000);
    }

    // Notify background
    notifyRecordingStatus();

  } catch (error) {
    console.error('[Audio Offscreen] Failed to start recording:', error);
    await cleanup();
    throw error;
  }
}

async function stopRecording() {
  if (!recorder) {
    console.warn('[Audio Offscreen] No active recorder');
    return;
  }

  console.log('[Audio Offscreen] Stopping recording');
  recordingState.isRecording = false;

  recorder.stop();
  stopSilenceDetection();
  stopDurationTimer();
}

async function streamChunk(chunk: Blob) {
  const servers = recordingConfig?.apiServers.filter(s => s.enabled) || [];

  for (const server of servers) {
    try {
      if (server.streamingMode === 'realtime') {
        await sendViaWebSocket(server.id, chunk);
      } else if (server.streamingMode === 'chunks') {
        await sendViaHttp(server, chunk, false);
      }
      // 'file' mode will upload the complete file at the end
    } catch (error) {
      console.error(`[Audio Offscreen] Failed to stream to ${server.name}:`, error);
    }
  }
}

async function connectWebSockets() {
  const servers = recordingConfig?.apiServers.filter(
    s => s.enabled && s.streamingMode === 'realtime'
  ) || [];

  for (const server of servers) {
    try {
      // Close existing connection if any
      const existing = websockets.get(server.id);
      if (existing) {
        existing.close();
      }

      // Create WebSocket URL (assume ws:// or wss:// prefix)
      let wsUrl = server.url;
      if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://');
      } else if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://');
      }

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log(`[Audio Offscreen] WebSocket connected: ${server.name}`);
        // Send authentication if token provided
        if (server.authToken) {
          ws.send(JSON.stringify({ type: 'auth', token: server.authToken }));
        }
        if (recordingConfig?.sessionMetadata && Object.keys(recordingConfig.sessionMetadata).length > 0) {
          ws.send(JSON.stringify({ type: 'metadata', data: recordingConfig.sessionMetadata }));
        }
      };

      ws.onerror = (error) => {
        console.error(`[Audio Offscreen] WebSocket error for ${server.name}:`, error);
      };

      ws.onclose = () => {
        console.log(`[Audio Offscreen] WebSocket closed: ${server.name}`);
        websockets.delete(server.id);
      };

      websockets.set(server.id, ws);
    } catch (error) {
      console.error(`[Audio Offscreen] Failed to connect WebSocket for ${server.name}:`, error);
    }
  }
}

async function sendViaWebSocket(serverId: string, chunk: Blob) {
  const ws = websockets.get(serverId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn(`[Audio Offscreen] WebSocket not ready for server ${serverId}`);
    return;
  }

  const arrayBuffer = await chunk.arrayBuffer();
  ws.send(arrayBuffer);
}

async function sendViaHttp(server: any, chunk: Blob, isFinalFile: boolean) {
  const formData = new FormData();
  formData.append('audio', chunk, isFinalFile ? 'recording.webm' : `chunk_${recordingState.chunkCount}.webm`);
  formData.append('chunkIndex', recordingState.chunkCount.toString());
  formData.append('timestamp', Date.now().toString());
  formData.append('isFinal', isFinalFile.toString());
  if (recordingConfig?.sessionMetadata) {
    for (const [key, value] of Object.entries(recordingConfig.sessionMetadata)) {
      if (value === undefined || value === null) continue;
      formData.append(key, String(value));
    }
  }

  const headers: any = {};
  if (server.authToken) {
    headers['Authorization'] = `Bearer ${server.authToken}`;
  }

  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      console.error(`[Audio Offscreen] HTTP upload failed for ${server.name}: ${response.status}`);
    }
  } catch (error) {
    console.error(`[Audio Offscreen] HTTP upload error for ${server.name}:`, error);
  }
}

async function uploadCompleteFile() {
  const blob = new Blob(audioData, { type: 'audio/webm' });

  // Upload to servers configured for 'file' mode
  const servers = recordingConfig?.apiServers.filter(
    s => s.enabled && s.streamingMode === 'file'
  ) || [];

  for (const server of servers) {
    await sendViaHttp(server, blob, true);
  }

  // Save locally if enabled
  if (recordingConfig?.recordingSettings.saveLocal) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${new Date().toISOString()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[Audio Offscreen] Recording saved locally');
  }
}

function startSilenceDetection() {
  if (!analyserNode) return;

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const silenceThreshold = 10; // Adjust as needed
  const silenceDuration = (recordingConfig?.recordingSettings.silenceDuration || 30) * 1000;

  silenceDetectionInterval = setInterval(() => {
    if (!analyserNode) return;

    analyserNode.getByteFrequencyData(dataArray);

    // Calculate average amplitude
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

    const isSilent = average < silenceThreshold;

    if (isSilent && !recordingState.isSilent) {
      // Silence started
      recordingState.isSilent = true;
      recordingState.silenceStartTime = Date.now();
      console.log('[Audio Offscreen] Silence detected');
    } else if (!isSilent && recordingState.isSilent) {
      // Sound resumed
      recordingState.isSilent = false;
      recordingState.silenceStartTime = 0;
      console.log('[Audio Offscreen] Sound resumed');
    } else if (isSilent && recordingState.isSilent) {
      // Check if silence duration exceeded
      const silentDuration = Date.now() - recordingState.silenceStartTime;
      if (silentDuration >= silenceDuration) {
        console.log('[Audio Offscreen] Silence duration exceeded, stopping recording');
        stopRecording();
      }
    }
  }, 100);
}

function stopSilenceDetection() {
  if (silenceDetectionInterval) {
    clearInterval(silenceDetectionInterval);
    silenceDetectionInterval = null;
  }
}

let durationTimer: ReturnType<typeof setInterval> | null = null;

function startDurationTimer() {
  durationTimer = setInterval(() => {
    recordingState.duration = Math.floor((Date.now() - recordingState.startTime) / 1000);
    notifyRecordingStatus();
  }, 1000);
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

function notifyRecordingStatus() {
  chrome.runtime.sendMessage({
    type: 'audio_recording_status_update',
    status: {
      isRecording: recordingState.isRecording,
      duration: recordingState.duration,
      chunkCount: recordingState.chunkCount,
    },
  }).catch(error => {
    console.error('[Audio Offscreen] Failed to notify status:', error);
  });
}

async function stopAllStreams() {
  for (const stream of activeStreams) {
    stream.getTracks().forEach(track => track.stop());
  }
  activeStreams = [];
}

async function cleanup() {
  // Stop recorder
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  recorder = null;

  // Stop all streams
  await stopAllStreams();

  // Close audio context
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
  analyserNode = null;

  // Close WebSockets
  for (const [id, ws] of websockets.entries()) {
    ws.close();
  }
  websockets.clear();

  // Stop timers
  stopSilenceDetection();
  stopDurationTimer();

  // Clear data
  audioData = [];

  // Notify
  recordingState.isRecording = false;
  notifyRecordingStatus();
}

console.log('[Audio Offscreen] Audio recorder initialized');
