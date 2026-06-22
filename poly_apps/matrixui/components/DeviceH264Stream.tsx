import React, { useEffect, useRef, useState, useCallback } from 'react';
import { wsService } from '../services/websocket';

interface DeviceH264StreamProps {
  deviceId: string;
  enabled: boolean;
  onError?: (error: Error) => void;
  onInit?: (info: { width: number; height: number; fps: number; format: string }) => void;
  showAsBackground?: boolean;
}

export const DeviceH264Stream: React.FC<DeviceH264StreamProps> = ({
  deviceId,
  enabled
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const decoderConfigured = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [browserSupport, setBrowserSupport] = useState<{
    webcodecs: boolean;
    canvas2d: boolean;
    webgl: boolean;
  } | null>(null);

  // Reconnection state
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelays = [1000, 2000, 4000, 8000, 16000, 30000]; // Max 30s

  // Hidden control layer state
  const [frameSize, setFrameSize] = useState({ width: 1080, height: 2340 });
  const isMouseDownRef = useRef(false);
  const lastSendTimeRef = useRef(0);

  // Check browser capabilities on mount (ONCE only, with proper cleanup)
  useEffect(() => {
    const checkSupport = () => {
      const support = {
        webcodecs: typeof VideoDecoder !== 'undefined',
        canvas2d: false,
        webgl: false
      };

      // Check Canvas 2D
      try {
        const testCanvas = document.createElement('canvas');
        const ctx2d = testCanvas.getContext('2d');
        support.canvas2d = !!ctx2d;
      } catch (e) {
        console.error('[H264Stream] Canvas 2D check failed:', e);
      }

      // Check WebGL (with proper cleanup to prevent context leak)
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        support.webgl = !!gl;

        // CRITICAL: Clean up WebGL context immediately after checking
        if (gl) {
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      } catch (e) {
        console.error('[H264Stream] WebGL check failed:', e);
      }

      console.log('[H264Stream] Browser support:', support);
      console.log('[H264Stream] User Agent:', navigator.userAgent);
      setBrowserSupport(support);

      if (!support.webcodecs) {
        console.error('[H264Stream] ✗ VideoDecoder not available in this browser/environment');
      }
      if (!support.canvas2d) {
        console.error('[H264Stream] ✗ Canvas 2D not available');
      }
      if (!support.webgl) {
        console.warn('[H264Stream] ⚠ WebGL not available (may affect performance)');
      }
    };

    checkSupport();
  }, []);

  // WebSocket connection function
  const connect = useCallback(() => {
    if (!browserSupport?.webcodecs) {
      console.error(`[H264Stream] WebCodecs not supported, cannot create stream for ${deviceId}`);
      setConnectionError('WebCodecs not supported in this browser');
      return;
    }

    console.log(`[H264Stream] Connecting WebSocket for ${deviceId} (attempt ${reconnectAttemptsRef.current + 1})`);
    setIsReconnecting(reconnectAttemptsRef.current > 0);
    setConnectionError(null);

    const ws = new WebSocket(`ws://localhost:48000/video/${deviceId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[H264Stream] WebSocket opened for ${deviceId}`);
      ws.send(JSON.stringify({ command: 'start_stream', device_id: deviceId }));
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      setIsReconnecting(false);
      setConnectionError(null);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleFrame(event.data);
      } else if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stream_started') {
          console.log(`[H264Stream] Stream started for ${deviceId}`);
          setIsConnected(true);
        } else if (msg.type === 'stream.paused') {
          console.log(`[H264Stream] ✓ Stream paused for ${deviceId}`);
        } else if (msg.type === 'stream.resumed') {
          console.log(`[H264Stream] ✓ Stream resumed for ${deviceId}`);
        } else if (msg.type === 'video.metadata') {
          // Update frame size for coordinate transformation
          console.log(`[H264Stream] Video metadata:`, msg.data);
          setFrameSize({
            width: msg.data.width,
            height: msg.data.height
          });
        } else if (msg.type === 'device.status') {
          // Handle device status updates from backend
          console.log(`[H264Stream] Device status update:`, msg.data);
          if (msg.data.status === 'error' || msg.data.status === 'reconnecting') {
            setConnectionError(msg.data.error_message || 'Device connection issue');
          } else if (msg.data.status === 'healthy') {
            setConnectionError(null);
          }
        }
      }
    };

    ws.onerror = (err) => {
      console.error(`[H264Stream] WebSocket error for ${deviceId}:`, err);
      setIsConnected(false);
      setConnectionError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log(`[H264Stream] WebSocket closed for ${deviceId}`, event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Attempt reconnection if enabled
      if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delayIndex = Math.min(reconnectAttemptsRef.current, reconnectDelays.length - 1);
        const delay = reconnectDelays[delayIndex];
        reconnectAttemptsRef.current++;

        console.log(
          `[H264Stream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
        );
        setIsReconnecting(true);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error(`[H264Stream] Max reconnection attempts reached for ${deviceId}`);
        setConnectionError(`Connection failed after ${maxReconnectAttempts} attempts`);
        setIsReconnecting(false);
      }
    };
  }, [browserSupport, deviceId, enabled]);

  // Main connection effect
  useEffect(() => {
    // Wait for browser support check to complete
    if (!browserSupport) {
      console.log(`[H264Stream] Waiting for browser support check...`);
      return;
    }

    if (!enabled) return;

    // Log support status
    console.log(`[H264Stream] Browser support: WebCodecs=${browserSupport.webcodecs}, Canvas2D=${browserSupport.canvas2d}, WebGL=${browserSupport.webgl}`);

    // Initial connection
    connect();

    return () => {
      console.log(`[H264Stream] Cleaning up ${deviceId}`);

      // Cancel reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Close decoder
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
        decoderConfigured.current = false;
      }

      setIsConnected(false);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };
  }, [enabled, browserSupport, connect]);

  // ========== Hidden Control Layer ==========
  // Coordinate transformation: window coords → device coords
  const convertCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * frameSize.width);
    const y = Math.floor((clientY - rect.top) / rect.height * frameSize.height);

    return { x, y };
  }, [frameSize]);

  // Send touch event (with throttling)
  const sendTouchEvent = useCallback(async (action: 'down' | 'up' | 'move', x: number, y: number) => {
    if (!isConnected) {
      console.warn('[H264Stream] Cannot send touch - not connected');
      return;
    }

    // Event throttling: move events max 60fps (16ms)
    const now = Date.now();
    if (action === 'move' && now - lastSendTimeRef.current < 16) {
      return;
    }
    lastSendTimeRef.current = now;

    try {
      console.log(`[H264Stream] Sending touch ${action} to ${deviceId} at (${x}, ${y}), screen: ${frameSize.width}x${frameSize.height}`);

      const result = await wsService.callRpc('control.touch', {
        deviceId: deviceId,
        action: action,
        pointerId: 0,
        x: x,
        y: y,
        pressure: 1.0,
        screenWidth: frameSize.width,
        screenHeight: frameSize.height
      });

      console.log(`[H264Stream] Touch ${action} result:`, result);

      if (result?.error) {
        console.error('[H264Stream] Touch event error:', result.error);
      }
    } catch (error) {
      console.error('[H264Stream] Failed to send touch event:', error);
    }
  }, [deviceId, isConnected, frameSize]);

  // Mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('[H264Stream] ========== MOUSE DOWN EVENT FIRED ==========');
    console.log('[H264Stream] Client position:', e.clientX, e.clientY);
    console.log('[H264Stream] Button:', e.button);
    console.log('[H264Stream] Target:', e.target);

    e.preventDefault();
    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) {
      console.warn('[H264Stream] [X] Failed to convert coordinates on mouseDown');
      return;
    }

    console.log(`[H264Stream] Mouse down at client(${e.clientX}, ${e.clientY}) -> device(${coords.x}, ${coords.y})`);
    console.log(`[H264Stream] isConnected: ${isConnected}, frameSize: ${frameSize.width}x${frameSize.height}`);

    isMouseDownRef.current = true;
    sendTouchEvent('down', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent, isConnected, frameSize]);

  // Mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;

    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    sendTouchEvent('move', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent]);

  // Mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;

    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    isMouseDownRef.current = false;
    sendTouchEvent('up', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent]);

  // Mouse leave - auto release if dragging
  const handleMouseLeave = useCallback(() => {
    if (isMouseDownRef.current) {
      console.log('[H264Stream] Mouse left canvas while dragging, auto-releasing touch');
      isMouseDownRef.current = false;
    }
  }, []);

  // Handle page visibility changes to pause/resume stream
  useEffect(() => {
    if (!enabled || !wsRef.current) return;

    const handleVisibilityChange = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      if (document.hidden) {
        // Page is hidden, pause stream
        console.log(`[H264Stream] Page hidden, pausing stream for ${deviceId}`);
        try {
          wsRef.current.send(JSON.stringify({ command: 'pause' }));
        } catch (error) {
          console.error(`[H264Stream] Failed to send pause command for ${deviceId}:`, error);
        }
      } else {
        // Page is visible, resume stream
        console.log(`[H264Stream] Page visible, resuming stream for ${deviceId}`);
        try {
          wsRef.current.send(JSON.stringify({ command: 'resume' }));
        } catch (error) {
          console.error(`[H264Stream] Failed to send resume command for ${deviceId}:`, error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, deviceId]);

  function handleFrame(buffer: ArrayBuffer) {
    const data = new Uint8Array(buffer);

    // Parse header
    let offset = 0;
    const serialLen = data[offset++];
    offset += serialLen;

    const header = new DataView(buffer, offset, 12);
    const ptsHigh = header.getUint32(0, false);
    const ptsLow = header.getUint32(4, false);
    const size = header.getUint32(8, false);
    offset += 12;

    const ptsRaw = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
    const isConfig = (ptsRaw & 0x8000000000000000n) !== 0n;
    const isKeyframe = (ptsRaw & 0x4000000000000000n) !== 0n;
    const pts = Number(ptsRaw & 0x3FFFFFFFFFFFFFFFn);

    const h264Data = data.slice(offset, offset + size);

    console.log(`[H264Stream] Frame: config=${isConfig}, keyframe=${isKeyframe}, size=${size}, pts=${pts}`);

    // Config frame - configure decoder
    if (isConfig) {
      console.log('[H264Stream] Received config frame, initializing/configuring decoder');
      if (!decoderRef.current) {
        initDecoder();
      }
      if (decoderRef.current) {
        configureDecoder(h264Data);
      }
      return;
    }

    // Video frame - decode
    if (!decoderConfigured.current || !decoderRef.current) {
      console.warn('[H264Stream] Skipping frame - decoder not ready');
      return;
    }

    const avccData = convertToAvcc(h264Data);
    const chunk = new EncodedVideoChunk({
      type: isKeyframe ? 'key' : 'delta',
      timestamp: pts,
      data: avccData
    });

    console.log(`[H264Stream] Decoding ${chunk.type} frame, size=${avccData.length}`);
    decoderRef.current.decode(chunk);
  }

  function initDecoder() {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 720;
    canvas.height = 1280;

    decoderRef.current = new VideoDecoder({
      output: (frame) => {
        if (canvas.width !== frame.codedWidth || canvas.height !== frame.codedHeight) {
          canvas.width = frame.codedWidth;
          canvas.height = frame.codedHeight;
        }
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
        frame.close();
      },
      error: (e) => {
        console.error('[H264Stream] Decoder error:', e);
        console.error('[H264Stream] Error name:', (e as Error).name);
        console.error('[H264Stream] Error message:', (e as Error).message);
        decoderConfigured.current = false;
      }
    });

    decoderConfigured.current = false;
  }

  function configureDecoder(data: Uint8Array) {
    if (!decoderRef.current) return;

    const nalus = extractNalus(data);
    const sps = nalus.filter(n => (n[0] & 0x1f) === 7);
    const pps = nalus.filter(n => (n[0] & 0x1f) === 8);

    console.log(`[H264Stream] Config frame: ${nalus.length} NALUs, SPS: ${sps.length}, PPS: ${pps.length}`);
    if (!sps.length || !pps.length) {
      console.error('[H264Stream] Missing SPS or PPS');
      return;
    }

    const avcc = buildAvcc(sps, pps);
    const codec = getCodec(sps[0]);

    console.log(`[H264Stream] Codec: ${codec}, AVCC size: ${avcc.byteLength} bytes`);
    console.log(`[H264Stream] Configuring decoder with no-preference acceleration...`);

    try {
      decoderRef.current.configure({
        codec,
        description: avcc.buffer,
        hardwareAcceleration: 'no-preference'
      });
      decoderConfigured.current = true;
      console.log(`[H264Stream] ✓ Decoder configured successfully (${codec})`);
    } catch (e) {
      console.error('[H264Stream] ✗ Configuration failed:', e);
      console.error('[H264Stream] Error details:', {
        name: (e as Error).name,
        message: (e as Error).message
      });
      decoderConfigured.current = false;
    }
  }

  function extractNalus(buffer: Uint8Array): Uint8Array[] {
    const nalus: Uint8Array[] = [];
    let start = -1;

    for (let i = 0; i < buffer.length; i++) {
      if (i + 3 < buffer.length && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
        if (start >= 0) nalus.push(buffer.slice(start, i));
        start = i + 4;
        i += 3;
      } else if (i + 2 < buffer.length && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
        if (start >= 0) nalus.push(buffer.slice(start, i));
        start = i + 3;
        i += 2;
      }
    }
    if (start >= 0) nalus.push(buffer.slice(start));
    return nalus;
  }

  function buildAvcc(sps: Uint8Array[], pps: Uint8Array[]): Uint8Array {
    const firstSps = sps[0];
    const totalLen = 7 + sps.reduce((s, n) => s + 2 + n.length, 0) + 1 + pps.reduce((s, n) => s + 2 + n.length, 0);
    const avcc = new Uint8Array(totalLen);
    let offset = 0;

    avcc[offset++] = 0x01;
    avcc[offset++] = firstSps[1];
    avcc[offset++] = firstSps[2];
    avcc[offset++] = firstSps[3];
    avcc[offset++] = 0xFF;
    avcc[offset++] = 0xE0 | sps.length;

    sps.forEach(n => {
      avcc[offset++] = (n.length >> 8) & 0xff;
      avcc[offset++] = n.length & 0xff;
      avcc.set(n, offset);
      offset += n.length;
    });

    avcc[offset++] = pps.length;
    pps.forEach(n => {
      avcc[offset++] = (n.length >> 8) & 0xff;
      avcc[offset++] = n.length & 0xff;
      avcc.set(n, offset);
      offset += n.length;
    });

    return avcc;
  }

  function getCodec(sps: Uint8Array): string {
    if (!sps || sps.length < 4) return 'avc1.42001E';
    const p = sps[1].toString(16).padStart(2, '0');
    const c = sps[2].toString(16).padStart(2, '0');
    const l = sps[3].toString(16).padStart(2, '0');
    return `avc1.${p}${c}${l}`;
  }

  function convertToAvcc(buffer: Uint8Array): Uint8Array {
    const nalus = extractNalus(buffer);
    if (!nalus.length) return buffer;

    const totalLen = nalus.reduce((s, n) => s + 4 + n.length, 0);
    const avcc = new Uint8Array(totalLen);
    let offset = 0;

    nalus.forEach(n => {
      avcc[offset++] = (n.length >>> 24) & 0xff;
      avcc[offset++] = (n.length >>> 16) & 0xff;
      avcc[offset++] = (n.length >>> 8) & 0xff;
      avcc[offset++] = n.length & 0xff;
      avcc.set(n, offset);
      offset += n.length;
    });

    return avcc;
  }

  if (!enabled) return null;

  // Show error if WebCodecs not supported
  if (browserSupport && !browserSupport.webcodecs) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-900/20">
        <div className="text-center p-4">
          <div className="text-red-500 font-mono text-sm mb-2">
            ✗ WebCodecs API Not Supported
          </div>
          <div className="text-red-400 font-mono text-xs">
            This environment does not support VideoDecoder API
          </div>
          <div className="text-gray-500 font-mono text-[10px] mt-2">
            {navigator.userAgent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Canvas with touch control layer - NO UI OVERLAYS */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover cursor-crosshair"
        style={{ display: 'block', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Manual Reconnect Button - ONLY shown when max attempts reached */}
      {connectionError && reconnectAttemptsRef.current >= maxReconnectAttempts && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-[#ff2a6d] text-sm font-mono mb-2">
              <i className="ph ph-warning text-xl"></i>
            </div>
            <div className="text-white/90 text-xs font-mono mb-2">
              Connection Failed
            </div>
            <div className="text-white/60 text-[10px] font-mono mb-4">
              {connectionError}
            </div>
            <button
              onClick={() => {
                reconnectAttemptsRef.current = 0;
                connect();
              }}
              className="px-4 py-2 bg-[#05ffa1] text-black text-xs font-mono rounded hover:bg-[#04cc81] transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
