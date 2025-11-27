let recorder;
let data = [];
let activeStreams = [];
let websocket = null;
let streamingConfig = null;
let chunkIndex = 0;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target === "offscreen") {
    switch (message.type) {
      case "start-recording":
        startRecording(message.data, message.streamingConfig);
        break;
      case "stop-recording":
        stopRecording();
        break;
      case "update-streaming-config":
        streamingConfig = message.streamingConfig;
        break;
      default:
        throw new Error("Unrecognized message:", message.type);
    }
  }
});

async function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    try {
      websocket = new WebSocket(url);
      websocket.binaryType = 'arraybuffer';
      
      websocket.onopen = () => {
        console.log('[Streaming] WebSocket connected');
        resolve(websocket);
      };
      
      websocket.onerror = (error) => {
        console.error('[Streaming] WebSocket error:', error);
        reject(error);
      };
      
      websocket.onclose = () => {
        console.log('[Streaming] WebSocket closed');
        websocket = null;
      };
    } catch (error) {
      reject(error);
    }
  });
}

async function sendChunkViaHttp(chunk, apiUrl, headers) {
  try {
    const formData = new FormData();
    formData.append('audio', chunk, `chunk_${chunkIndex}.webm`);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('timestamp', Date.now().toString());
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers || {},
      body: formData,
    });
    
    if (!response.ok) {
      console.error('[Streaming] HTTP send failed:', response.status);
    }
    
    chunkIndex++;
  } catch (error) {
    console.error('[Streaming] HTTP send error:', error);
  }
}

async function sendChunkViaWebSocket(chunk) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    const arrayBuffer = await chunk.arrayBuffer();
    websocket.send(arrayBuffer);
    chunkIndex++;
  }
}

async function startRecording(streamId, config) {
  if (recorder?.state === "recording") {
    throw new Error("Called startRecording while recording is in progress.");
  }

  await stopAllStreams();
  
  streamingConfig = config || null;
  chunkIndex = 0;

  try {
    // Connect WebSocket if streaming mode is websocket
    if (streamingConfig && streamingConfig.mode === 'websocket') {
      await connectWebSocket(streamingConfig.url);
    }

    // Get tab audio stream
    const tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // Get microphone stream with noise cancellation (optional)
    let micStream = null;
    if (!streamingConfig || streamingConfig.includeMicrophone !== false) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        activeStreams.push(micStream);
      } catch (micError) {
        console.warn('[Recording] Microphone not available, recording tab audio only');
      }
    }

    activeStreams.push(tabStream);

    // Create audio context
    const audioContext = new AudioContext();

    // Create sources and destination
    const tabSource = audioContext.createMediaStreamSource(tabStream);
    const destination = audioContext.createMediaStreamDestination();

    // Create gain nodes
    const tabGain = audioContext.createGain();
    tabGain.gain.value = 1.0;

    // Connect tab audio to both speakers and recorder
    tabSource.connect(tabGain);
    tabGain.connect(audioContext.destination);
    tabGain.connect(destination);

    // Connect mic to recorder only (prevents echo)
    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      const micGain = audioContext.createGain();
      micGain.gain.value = 1.5;
      micSource.connect(micGain);
      micGain.connect(destination);
    }

    // Start recording
    recorder = new MediaRecorder(destination.stream, {
      mimeType: "audio/webm",
    });
    
    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        // Streaming mode: send chunks to external service
        if (streamingConfig && streamingConfig.enabled) {
          if (streamingConfig.mode === 'websocket') {
            await sendChunkViaWebSocket(event.data);
          } else if (streamingConfig.mode === 'http') {
            await sendChunkViaHttp(event.data, streamingConfig.url, streamingConfig.headers);
          }
        }
        
        // Also save locally if saveLocal is true or streaming is disabled
        if (!streamingConfig || streamingConfig.saveLocal !== false) {
          data.push(event.data);
        }
      }
    };
    
    recorder.onstop = () => {
      // Close WebSocket if open
      if (websocket) {
        websocket.close();
        websocket = null;
      }
      
      // Save local file if we have data
      if (data.length > 0) {
        const blob = new Blob(data, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = `recording-${new Date().toISOString()}.webm`;
        downloadLink.click();

        URL.revokeObjectURL(url);
      }
      
      recorder = undefined;
      data = [];
      streamingConfig = null;

      chrome.runtime.sendMessage({
        type: "recording-stopped",
        target: "service-worker",
      });
    };

    // Start with timeslice for streaming (get data every 1 second)
    const timeslice = streamingConfig && streamingConfig.enabled ? 
      (streamingConfig.chunkInterval || 1000) : undefined;
    
    recorder.start(timeslice);
    window.location.hash = "recording";

    chrome.runtime.sendMessage({
      type: "update-icon",
      target: "service-worker",
      recording: true,
    });
    
    console.log('[Recording] Started', streamingConfig ? 
      `with streaming (${streamingConfig.mode})` : 'local only');
      
  } catch (error) {
    console.error("Error starting recording:", error);
    
    let errorMsg = error.message;
    if (error.name === 'NotAllowedError') {
      errorMsg = "Microphone permission denied. Please go to chrome://settings/content/microphone and allow access, then reload the extension.";
    } else if (error.name === 'NotFoundError') {
      errorMsg = "No microphone device found. Please connect a microphone.";
    } else if (error.name === 'NotReadableError') {
      errorMsg = "Microphone is in use by another application. Please close other apps using the microphone.";
    }
    
    chrome.runtime.sendMessage({
      type: "recording-error",
      target: "popup",
      error: errorMsg,
    });
  }
}

async function stopRecording() {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
  }

  await stopAllStreams();
  window.location.hash = "";

  chrome.runtime.sendMessage({
    type: "update-icon",
    target: "service-worker",
    recording: false,
  });
}

async function stopAllStreams() {
  activeStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  });

  activeStreams = [];
  await new Promise((resolve) => setTimeout(resolve, 100));
}
