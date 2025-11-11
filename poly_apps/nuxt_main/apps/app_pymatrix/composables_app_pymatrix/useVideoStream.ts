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
   * Handle binary message - Standard MSE Protocol
   *
   * Backend sends standard fMP4 (Fragmented MP4) format:
   * - First message: fMP4 init segment [ftyp][moov] boxes
   * - Subsequent messages: fMP4 media segments [moof][mdat] boxes
   *
   * No custom frame parsing needed - MediaSource API handles fMP4 natively
   *
   * Reference: BRIDGE_FILE_SPECIFICATION.md - Standard MSE Protocol
   */
  function handleBinaryMessage(data: ArrayBuffer) {
    // ✅ Standard MSE: Direct fMP4 segment push
    // Backend already sends proper fMP4 format via VideoStreamHandler

    console.log(`[useVideoStream] Received fMP4 segment: ${data.byteLength} bytes`);

    // Push fMP4 segment directly to buffer queue
    // MediaSource API will parse fMP4 boxes ([ftyp][moov][moof][mdat])
    bufferQueue.push(data);
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

      /**
       * H.264 Codec String Selection for fMP4
       *
       * Format: avc1.PPCCLL
       *   PP = Profile (42=Baseline, 4D=Main, 64=High)
       *   CC = Constraint flags
       *   LL = Level (28=4.0, 1F=3.1, 1E=3.0)
       *
       * Scrcpy uses High Profile by default, but we try fallback for compatibility:
       * 1. avc1.640028 - High Profile Level 4.0 (best quality, scrcpy default)
       * 2. avc1.64001F - High Profile Level 3.1 (good quality)
       * 3. avc1.4D401F - Main Profile Level 3.1 (good balance)
       * 4. avc1.42E01E - Baseline Profile Level 3.0 (maximum compatibility)
       *
       * Reference: BRIDGE_FILE_SPECIFICATION.md - MediaSource Configuration
       */
      const codecCandidates = [
        'video/mp4; codecs="avc1.640028"',  // High Profile Level 4.0
        'video/mp4; codecs="avc1.64001F"',  // High Profile Level 3.1
        'video/mp4; codecs="avc1.4D401F"',  // Main Profile Level 3.1
        'video/mp4; codecs="avc1.42E01E"',  // Baseline Profile Level 3.0
      ];

      let codec: string | null = null;
      for (const candidate of codecCandidates) {
        if (MediaSource.isTypeSupported(candidate)) {
          codec = candidate;
          console.log('[useVideoStream] Selected codec:', codec);
          break;
        }
      }

      if (!codec) {
        console.error('[useVideoStream] No supported H.264 codec found');
        console.log('[useVideoStream] Tested codecs:', codecCandidates);
        alert('Video codec not supported by your browser. Please try Chrome, Firefox, or Edge.');
        return;
      }

      // Create SourceBuffer with selected codec
      sourceBuffer.value = mediaSource.value.addSourceBuffer(codec);

      /**
       * SourceBuffer mode: 'sequence'
       *
       * In sequence mode:
       * - Timestamps are ignored, frames play in arrival order
       * - Best for real-time streaming (live video)
       * - Better error tolerance
       * - Automatically manages buffer
       *
       * Alternative 'segments' mode would require accurate PTS in fMP4
       */
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
