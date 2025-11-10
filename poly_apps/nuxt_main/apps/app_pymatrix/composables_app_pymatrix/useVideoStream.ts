import { ref, onMounted, onUnmounted } from 'vue';
import { useWSRPC } from '@/composables/useWSRPC';
import { buildVideoWsUrl } from '@/apps/app_pymatrix/utils_app_pymatrix/api-urls';
import type { VideoMetadata, VideoInitMessage, WSRPCMessage } from '@/types/pymatrix';

interface UseVideoStreamOptions {
  deviceSerial: string;
  baseUrl?: string;
  quality?: string;
  fps?: number;
  bitrate?: number;
}

export function useVideoStream(options: UseVideoStreamOptions) {
  const videoElement = ref<HTMLVideoElement | null>(null);
  const mediaSource = ref<MediaSource | null>(null);
  const sourceBuffer = ref<SourceBuffer | null>(null);
  const connected = ref(false);
  const metrics = ref<VideoMetadata>({
    fps: 0,
    droppedFrames: 0,
    latency: 0
  });
  const videoInfo = ref<VideoInitMessage | null>(null);
  const bufferQueue: ArrayBuffer[] = [];
  let isAppending = false;

  const wsUrl = buildVideoWsUrl(options.deviceSerial, {
    quality: options.quality,
    fps: options.fps,
    bitrate: options.bitrate,
    baseUrl: options.baseUrl,
  });

  const { connect: connectWS, disconnect: disconnectWS, sendMessage, connected: wsConnected } = useWSRPC({
    url: wsUrl,
    onMessage: handleTextMessage,
    onBinaryMessage: handleBinaryMessage,
    onConnect: () => {
      console.log('[useVideoStream] WebSocket connected');
      connected.value = true;
    },
    onDisconnect: () => {
      console.log('[useVideoStream] WebSocket disconnected');
      connected.value = false;
      cleanup();
    },
    onError: (error) => {
      console.error('[useVideoStream] WebSocket error:', error);
      alert(`Failed to connect to video stream: ${error}`);
    }
  });

  function handleTextMessage(message: WSRPCMessage) {
    if (message.type === 'video.connected') {
      console.log('[useVideoStream] Video stream connected:', message.data);
    } else if (message.type === 'video.init') {
      console.log('[useVideoStream] Received video.init:', message.data);
      videoInfo.value = message.data as VideoInitMessage;
      initializeMediaSource(message.data);
    } else if (message.type === 'video.metadata') {
      metrics.value = message.data as VideoMetadata;
    } else if (message.type === 'video.error' || message.type === 'error') {
      console.error('[useVideoStream] Video stream error:', message.data);
      // Show error to user
      alert(`Video stream error: ${message.data.error || message.data.message || 'Unknown error'}`);
    }
  }

  /**
   * Parse binary frame according to scrcpy_web_test specification
   * Frame format: [serial_length(1)][serial(N)][pts(8)][size(4)][h264_data(N)]
   */
  function parseBinaryFrame(data: ArrayBuffer) {
    const view = new DataView(data);
    let offset = 0;

    // 1. Read serial length (1 byte)
    const serialLength = view.getUint8(offset);
    offset += 1;

    // 2. Read serial (N bytes)
    const serialBytes = new Uint8Array(data, offset, serialLength);
    const serial = new TextDecoder('utf-8').decode(serialBytes);
    offset += serialLength;

    // 3. Read PTS (8 bytes, Big Endian)
    const ptsHigh = view.getUint32(offset, false);  // Big Endian
    const ptsLow = view.getUint32(offset + 4, false);
    const pts = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
    offset += 8;

    // Extract flags from PTS
    const PTS_MASK = 0x3FFFFFFFFFFFFFFFn;
    const FLAG_CONFIG_FRAME = 0x8000000000000000n;
    const FLAG_KEY_FRAME = 0x4000000000000000n;

    const isConfigFrame = !!(pts & FLAG_CONFIG_FRAME);
    const isKeyFrame = !!(pts & FLAG_KEY_FRAME);
    const actualPts = pts & PTS_MASK;

    // 4. Read size (4 bytes, Big Endian)
    const size = view.getUint32(offset, false);
    offset += 4;

    // 5. Extract H.264 data
    const h264Data = data.slice(offset, offset + size);

    console.log(`[Frame] serial=${serial}, pts=${actualPts}, size=${size}, config=${isConfigFrame}, key=${isKeyFrame}`);

    return {
      serial,
      pts: actualPts,
      size,
      isConfigFrame,
      isKeyFrame,
      h264Data
    };
  }

  function handleBinaryMessage(data: ArrayBuffer) {
    // Parse frame header
    const frame = parseBinaryFrame(data);
    
    // Verify serial matches expected device
    if (frame.serial !== options.deviceSerial) {
      console.warn(`[useVideoStream] Frame serial mismatch: expected ${options.deviceSerial}, got ${frame.serial}`);
      return;
    }

    // Push H.264 data to buffer queue
    bufferQueue.push(frame.h264Data);
    processBufferQueue();
  }

  function initializeMediaSource(data: VideoInitMessage) {
    if (!videoElement.value) {
      console.error('[useVideoStream] Video element not ready');
      return;
    }

    console.log('[useVideoStream] Initializing MediaSource for', data);
    console.log('[useVideoStream] Video resolution:', data.width, 'x', data.height);
    console.log('[useVideoStream] Codec:', data.codec);
    console.log('[useVideoStream] Bitrate:', data.bitrate);

    mediaSource.value = new MediaSource();
    videoElement.value.src = URL.createObjectURL(mediaSource.value);

    mediaSource.value.addEventListener('sourceopen', () => {
      if (!mediaSource.value) return;

      // Use fMP4 codec for H.264
      const codec = 'video/mp4; codecs="avc1.64001F"';

      console.log('[useVideoStream] Checking codec support:', codec);

      if (!MediaSource.isTypeSupported(codec)) {
        console.error('[useVideoStream] Codec not supported:', codec);
        console.log('[useVideoStream] Supported types:', [
          'video/mp4; codecs="avc1.42E01E"',
          'video/mp4; codecs="avc1.64001F"',
          'video/mp4; codecs="avc1.640028"'
        ].filter(MediaSource.isTypeSupported));
        alert('Video codec not supported by your browser. Please try a different browser.');
        return;
      }

      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        sourceBuffer.value = mediaSource.value.addSourceBuffer(codec);
        sourceBuffer.value.mode = 'sequence';

        sourceBuffer.value.addEventListener('updateend', () => {
          isAppending = false;
          processBufferQueue();
        });

        sourceBuffer.value.addEventListener('error', (e) => {
          console.error('[useVideoStream] SourceBuffer error:', e);
          alert('Video buffer error. The stream may be corrupted.');
        });

        console.log('[useVideoStream] ✓ SourceBuffer created successfully');
    });

    mediaSource.value.addEventListener('sourceclose', () => {
      console.log('[useVideoStream] MediaSource closed');
    });

    mediaSource.value.addEventListener('error', (e) => {
      console.error('[useVideoStream] MediaSource error:', e);
      alert('Video source error. Please reconnect the device.');
    });
  }

  function processBufferQueue() {
    if (!sourceBuffer.value || isAppending || bufferQueue.length === 0) {
      return;
    }

    if (sourceBuffer.value.updating) {
      return;
    }

    const chunk = bufferQueue.shift();
    if (chunk) {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        isAppending = true;
        sourceBuffer.value.appendBuffer(chunk);
    }
  }

  function changeQuality(quality: 'high' | 'medium' | 'low') {
    if (!wsConnected.value) {
      return;
    }

    sendMessage({
      type: 'video.quality',
      timestamp: Date.now(),
      data: { quality }
    });
  }

  function pause() {
    if (!wsConnected.value) {
      return;
    }

    sendMessage({
      type: 'video.pause',
      timestamp: Date.now(),
      data: {}
    });
  }

  function resume() {
    if (!wsConnected.value) {
      return;
    }

    sendMessage({
      type: 'video.resume',
      timestamp: Date.now(),
      data: {}
    });
  }

  function cleanup() {
    bufferQueue.length = 0;
    isAppending = false;

    if (sourceBuffer.value) {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        if (mediaSource.value && mediaSource.value.readyState === 'open') {
          mediaSource.value.removeSourceBuffer(sourceBuffer.value);
        }
      sourceBuffer.value = null;
    }

    if (mediaSource.value) {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        if (mediaSource.value.readyState === 'open') {
          mediaSource.value.endOfStream();
        }
      mediaSource.value = null;
    }

    if (videoElement.value) {
      videoElement.value.src = '';
    }
  }

  function connect() {
    connectWS();
  }

  function disconnect() {
    disconnectWS();
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    videoElement,
    connected,
    metrics,
    videoInfo,
    connect,
    disconnect,
    changeQuality,
    pause,
    resume
  };
}
