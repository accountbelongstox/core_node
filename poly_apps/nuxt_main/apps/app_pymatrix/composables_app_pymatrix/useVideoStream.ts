import { ref, onMounted, onUnmounted } from 'vue';
import { useWSRPC } from '../../../composables/useWSRPC';
import type { VideoMetadata, VideoInitMessage, WSRPCMessage } from '../../../types/pymatrix';

interface UseVideoStreamOptions {
  deviceSerial: string;
  baseUrl: string;
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

  const wsUrl = `${options.baseUrl}/ws/video/${options.deviceSerial}`;

  const { connect: connectWS, disconnect: disconnectWS, sendMessage, connected: wsConnected } = useWSRPC({
    url: wsUrl,
    onMessage: handleTextMessage,
    onBinaryMessage: handleBinaryMessage,
    onConnect: () => {
      connected.value = true;
    },
    onDisconnect: () => {
      connected.value = false;
      cleanup();
    },
    onError: (error) => {
      console.error('Video stream WebSocket error:', error);
    }
  });

  function handleTextMessage(message: WSRPCMessage) {
    if (message.type === 'video.connected') {
      console.log('Video stream connected:', message.data);
    } else if (message.type === 'video.init') {
      videoInfo.value = message.data as VideoInitMessage;
      initializeMediaSource(message.data);
    } else if (message.type === 'video.metadata') {
      metrics.value = message.data as VideoMetadata;
    } else if (message.type === 'error') {
      console.error('Video stream error:', message.data);
    }
  }

  function handleBinaryMessage(data: ArrayBuffer) {
    bufferQueue.push(data);
    processBufferQueue();
  }

  function initializeMediaSource(data: VideoInitMessage) {
    if (!videoElement.value) {
      console.error('[useVideoStream] Video element not ready');
      return;
    }

    console.log('[useVideoStream] Initializing MediaSource for', data);

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
        return;
      }

      try {
        sourceBuffer.value = mediaSource.value.addSourceBuffer(codec);
        sourceBuffer.value.mode = 'sequence';

        sourceBuffer.value.addEventListener('updateend', () => {
          isAppending = false;
          processBufferQueue();
        });

        sourceBuffer.value.addEventListener('error', (e) => {
          console.error('[useVideoStream] SourceBuffer error:', e);
        });

        console.log('[useVideoStream] SourceBuffer created successfully');
      } catch (e) {
        console.error('[useVideoStream] Failed to create SourceBuffer:', e);
      }
    });

    mediaSource.value.addEventListener('sourceclose', () => {
      console.log('[useVideoStream] MediaSource closed');
    });

    mediaSource.value.addEventListener('error', (e) => {
      console.error('[useVideoStream] MediaSource error:', e);
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
      try {
        isAppending = true;
        sourceBuffer.value.appendBuffer(chunk);
      } catch (e) {
        console.error('Failed to append buffer:', e);
        isAppending = false;
      }
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
      try {
        if (mediaSource.value && mediaSource.value.readyState === 'open') {
          mediaSource.value.removeSourceBuffer(sourceBuffer.value);
        }
      } catch (e) {
        console.error('Error removing source buffer:', e);
      }
      sourceBuffer.value = null;
    }

    if (mediaSource.value) {
      try {
        if (mediaSource.value.readyState === 'open') {
          mediaSource.value.endOfStream();
        }
      } catch (e) {
        console.error('Error ending media source:', e);
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
