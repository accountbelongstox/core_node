import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLYUVRenderer } from '../utils/WebGLYUVRenderer';
import { wsService } from '../services/websocket';
import { configService, GlobalConfig } from '../services/configService';

interface VideoStreamOptions {
  deviceId: string; // Use deviceId instead of serial
  enabled?: boolean;
  streamType?: 'h264' | 'yuv';
  hwaccel?: 'cuda' | 'qsv' | 'dxva2' | 'vaapi' | 'auto';
  onError?: (error: Error) => void;
  onInit?: (info: { width: number; height: number; fps: number; format: string }) => void;
}

interface VideoInitMessage {
  type: 'video.init';
  timestamp: number;
  data: {
    serial: string;
    codec: string;
    format?: string;
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    hwaccel?: string;
  };
}

interface VideoMetadataMessage {
  type: 'video.metadata';
  timestamp: number;
  data: {
    fps: number;
    frames: number;
    bytes: number;
    mbps: number;
    format?: string;
  };
}

/**
 * Hook for managing video stream connection and WebGL rendering
 */
export function useVideoStream({
  deviceId,
  enabled = true,
  streamType = 'yuv',
  hwaccel,
  onError,
  onInit
}: VideoStreamOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGLYUVRenderer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ width: number; height: number; fps: number; format: string } | null>(null);
  
  // Use refs to track connection state without causing re-renders
  const connectionStateRef = useRef({ 
    isConnecting: false, 
    isConnected: false, 
    deviceConnected: false,
    errorCount: 0 
  });
  const onErrorRef = useRef(onError);
  const onInitRef = useRef(onInit);
  
  // Global map to track which devices have been connected via device.connect
  // This prevents multiple calls to device.connect for the same device
  const deviceConnectMapRef = useRef<Map<string, boolean>>(new Map());
  
  // Track current stream mode from config for auto-reconnect
  const currentStreamModeRef = useRef<'h264' | 'yuv' | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onInitRef.current = onInit;
  }, [onError, onInit]);

  // Initialize WebGL renderer (only for YUV stream)
  useEffect(() => {
    if (!canvasRef.current || !enabled || streamType !== 'yuv') return;

    try {
      rendererRef.current = new WebGLYUVRenderer(canvasRef.current);
    } catch (error) {
      console.error(`[useVideoStream] Failed to initialize WebGL renderer for ${deviceId}:`, error);
      onError?.(error instanceof Error ? error : new Error('WebGL initialization failed'));
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [enabled, streamType, deviceId, onError]);

  // Internal connect function that accepts streamType and hwaccel as parameters
  // This allows reconnection with new config values without waiting for props to update
  const connectInternal = useCallback(async (targetStreamType: 'h264' | 'yuv', targetHwaccel?: string) => {
    // Use ref to check state without causing dependency issues
    if (!enabled || connectionStateRef.current.isConnecting || connectionStateRef.current.isConnected) {
      console.log(`[useVideoStream] Skipping connect for ${deviceId}: enabled=${enabled}, isConnecting=${connectionStateRef.current.isConnecting}, isConnected=${connectionStateRef.current.isConnected}`);
      return;
    }
    
    console.log(`[useVideoStream] Starting connection for ${deviceId} (streamType=${targetStreamType})`);
    connectionStateRef.current.isConnecting = true;
    setIsConnecting(true);
    
    try {
      // First, connect device via RPC v2
      console.log(`[useVideoStream] Checking RPC connection for ${deviceId}...`);
      if (!wsService.isRpcConnected()) {
        console.log(`[useVideoStream] RPC not connected, connecting...`);
        await wsService.connectRpc();
        console.log(`[useVideoStream] RPC connected`);
      } else {
        console.log(`[useVideoStream] RPC already connected`);
      }

      // Connect device via RPC BEFORE opening video WebSocket (device connection takes 30s)
      console.log(`[useVideoStream] Connecting device ${deviceId} via RPC...`);
      const connectResult = await wsService.callRpc('device.connect', { deviceId });
      if (!connectResult.success) {
        const error = new Error(`Failed to connect device: ${connectResult.error || 'Unknown error'}`);
        console.error(`[useVideoStream] ${error.message}`);
        onErrorRef.current?.(error);
        return;
      }
      console.log(`[useVideoStream] Device ${deviceId} connected successfully via RPC`);

      // Build WebSocket URL based on stream type
      // Backend routes:
      // - H.264: /video/{device_id} (NOT /ws/video/{device_id})
      // - YUV: /video/yuv/{device_id}
      // Use deviceId from device.list API (e.g., "device_1", "device_2")
      // CRITICAL: deviceId MUST be in format "device_N", NOT a serial like "192.168.50.44:5555"

      // Validate deviceId format
      if (!deviceId || (!deviceId.startsWith('device_') && deviceId.includes(':'))) {
        const error = new Error(`Invalid deviceId format: ${deviceId}. Expected format: "device_1", "device_2", etc. Got what looks like a serial number.`);
        console.error(`[useVideoStream] ${error.message}`);
        onErrorRef.current?.(error);
        return;
      }
      
      // Encode it properly using encodeURIComponent
      const encodedDeviceId = encodeURIComponent(deviceId);
      let wsUrl: string;
      if (targetStreamType === 'yuv') {
        // YUV endpoint: /video/yuv/{device_id}
        wsUrl = `ws://localhost:48000/video/yuv/${encodedDeviceId}`;
        if (targetHwaccel) {
          wsUrl += `?hwaccel=${targetHwaccel}`;
        }
        console.log(`[useVideoStream] Using YUV endpoint: ${wsUrl} (deviceId: ${deviceId})`);
      } else {
        // H.264 stream endpoint: /video/{device_id}
        wsUrl = `ws://localhost:48000/video/${encodedDeviceId}`;
        console.log(`[useVideoStream] Using H.264 endpoint: ${wsUrl} (deviceId: ${deviceId})`);
      }
      
      console.log(`[useVideoStream] Connecting to ${targetStreamType} stream for ${deviceId}`);
      console.log(`[useVideoStream] WebSocket URL: ${wsUrl}`);
      console.log(`[useVideoStream] WebGL renderer ready: ${rendererRef.current ? 'yes' : 'no'}`);
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      
      console.log(`[useVideoStream] WebSocket created for ${deviceId}, readyState: ${ws.readyState}`);

      ws.onopen = () => {
        console.log(`[useVideoStream] ✓ WebSocket OPENED for ${deviceId} (streamType=${targetStreamType})`);
        console.log(`[useVideoStream] WebSocket readyState: ${ws.readyState}, protocol: ${ws.protocol}`);
        connectionStateRef.current.isConnected = true;
        connectionStateRef.current.isConnecting = false;
        setIsConnected(true);
        setIsConnecting(false);
        console.log(`[useVideoStream] Waiting for video.init message...`);
      };

      ws.onmessage = (event) => {
        console.log(`[useVideoStream] Received message for ${deviceId}, type: ${event.data instanceof ArrayBuffer ? 'binary' : typeof event.data}, size: ${event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.length}`);
        
        // Handle binary YUV/H.264 data
        if (event.data instanceof ArrayBuffer) {
          console.log(`[useVideoStream] ========== BINARY FRAME RECEIVED ==========`);
          console.log(`[useVideoStream] Binary frame received for ${deviceId}, size: ${event.data.byteLength} bytes`);
          console.log(`[useVideoStream] Current streamType: ${targetStreamType}`);
          console.log(`[useVideoStream] Renderer ready: ${rendererRef.current ? 'YES' : 'NO'}`);

          if (targetStreamType === 'yuv') {
            if (!rendererRef.current) {
              console.warn(`[useVideoStream] No WebGL renderer for ${deviceId}, cannot render frame`);
              return;
            }
            
            try {
              const data = new Uint8Array(event.data);
              console.log(`[useVideoStream] ========== PARSING YUV FRAME ==========`);
              console.log(`[useVideoStream] Parsing YUV frame for ${deviceId}, total size: ${data.length} bytes`);
              console.log(`[useVideoStream] First 16 bytes (hex):`, Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

              // Parse YUV frame protocol according to API_DOCUMENTATION.md:
              // [serial_len(1)][serial(N)][pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)][Y data][U data][V data]
              // Note: frameSerial from backend is the actual device serial, not deviceId

              let offset = 0;

              // Read serial length (backend sends actual serial in frame, not deviceId)
              const serialLen = data[offset++];
              console.log(`[useVideoStream] [STEP 1] Frame serial length: ${serialLen}, offset now: ${offset}`);

              if (serialLen === 0 || offset + serialLen > data.length) {
                console.error(`[useVideoStream] ✗ INVALID SERIAL LENGTH: ${serialLen}, data length: ${data.length}`);
                return;
              }

              // Extract serial (backend sends actual serial, we can log it but don't need to verify against deviceId)
              const frameSerial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
              offset += serialLen;
              console.log(`[useVideoStream] [STEP 2] Frame serial: "${frameSerial}" (deviceId: ${deviceId}), offset now: ${offset}`);
              
              // Note: We don't verify frameSerial against deviceId because:
              // - deviceId is a frontend abstraction (e.g., "device_1")
              // - frameSerial is the actual device serial from backend (e.g., "ABC123" or "192.168.50.44:5555")
              // Backend already ensures frames are routed to correct WebSocket connection
              
              // Parse frame header (big-endian as per protocol)
              // Protocol: [pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)]
              // Use absolute offset like scrcpy_webgl_test for correctness
              console.log(`[useVideoStream] [STEP 3] Parsing header starting at offset: ${offset}`);
              const view = new DataView(event.data);
              const pts = view.getBigUint64(offset); offset += 8;
              const width = view.getUint16(offset); offset += 2;
              const height = view.getUint16(offset); offset += 2;
              const ySize = view.getInt32(offset); offset += 4;
              const uSize = view.getInt32(offset); offset += 4;
              const vSize = view.getInt32(offset); offset += 4;

              console.log(`[useVideoStream] [STEP 4] Header parsed, offset now: ${offset}`);
              console.log(`[useVideoStream] Frame dimensions: ${width}x${height}`);
              console.log(`[useVideoStream] Plane sizes: Y=${ySize}, U=${uSize}, V=${vSize}, Total=${ySize+uSize+vSize}`);
              console.log(`[useVideoStream] PTS: ${pts}`);

              // Verify data sizes
              const expectedTotalSize = ySize + uSize + vSize;
              const remainingBytes = data.length - offset;
              console.log(`[useVideoStream] [STEP 5] Data verification:`);
              console.log(`  - Current offset: ${offset}`);
              console.log(`  - Expected YUV data: ${expectedTotalSize} bytes`);
              console.log(`  - Remaining in buffer: ${remainingBytes} bytes`);
              console.log(`  - Match: ${remainingBytes >= expectedTotalSize ? 'YES ✓' : 'NO ✗'}`);

              if (offset + expectedTotalSize > data.length) {
                console.error(`[useVideoStream] ✗ INVALID FRAME: Need ${offset + expectedTotalSize} bytes, have ${data.length}`);
                return;
              }

              // Extract YUV planes using slice (create copies) like scrcpy_webgl_test
              console.log(`[useVideoStream] [STEP 6] Extracting YUV planes...`);
              const yPlane = data.slice(offset, offset + ySize); offset += ySize;
              const uPlane = data.slice(offset, offset + uSize); offset += uSize;
              const vPlane = data.slice(offset, offset + vSize);

              console.log(`[useVideoStream] [STEP 7] Planes extracted:`);
              console.log(`  - Y: ${yPlane.length} bytes (expected: ${ySize})`);
              console.log(`  - U: ${uPlane.length} bytes (expected: ${uSize})`);
              console.log(`  - V: ${vPlane.length} bytes (expected: ${vSize})`);
              console.log(`  - Y sample (first 8 bytes): ${Array.from(yPlane.slice(0, 8)).join(', ')}`);

              // Render frame WITHOUT stride information (backend sends tightly-packed data)
              // Backend already stripped linesize padding, so data is tightly packed
              console.log(`[useVideoStream] [STEP 8] Calling renderFrame(width=${width}, height=${height})...`);
              try {
                rendererRef.current.renderFrame(
                  yPlane,
                  uPlane,
                  vPlane,
                  width,
                  height
                  // No stride parameters - data is tightly packed
                );
                console.log(`[useVideoStream] ========== ✓ FRAME RENDERED SUCCESSFULLY ==========`);
              } catch (renderError) {
                console.error(`[useVideoStream] ========== ✗ RENDER ERROR ==========`);
                console.error(`[useVideoStream] Render error for ${deviceId}:`, renderError);
                console.error(`[useVideoStream] Render error details:`, renderError instanceof Error ? renderError.stack : renderError);
              }
            } catch (error) {
              console.error(`[useVideoStream] Failed to parse YUV frame for ${deviceId}:`, error);
              console.error(`[useVideoStream] Error details:`, error instanceof Error ? error.stack : error);
            }
          } else if (targetStreamType === 'h264') {
            // TODO: Implement H.264 decoding (WebCodecs API or MSE)
            console.warn(`[useVideoStream] H.264 stream not yet implemented for ${deviceId}, received ${event.data.byteLength} bytes`);
          }
        } 
        // Handle JSON messages (init, metadata, errors, etc.)
        else if (typeof event.data === 'string') {
          console.log(`[useVideoStream] JSON message received for ${deviceId}:`, event.data.substring(0, 200));
          try {
            const message = JSON.parse(event.data);
            console.log(`[useVideoStream] Parsed message type: ${message.type} for ${deviceId}`);
            
            // Handle initialization message
            if (message.type === 'video.init') {
              const initMsg = message as VideoInitMessage;
              const info = {
                width: initMsg.data.width,
                height: initMsg.data.height,
                fps: initMsg.data.fps,
                format: initMsg.data.format || initMsg.data.codec
              };
              console.log(`[useVideoStream] ✓ Stream initialized for ${deviceId}:`, info);
              setStreamInfo(info);
              onInitRef.current?.(info);
            }
            // Handle metadata message
            else if (message.type === 'video.metadata') {
              const metaMsg = message as VideoMetadataMessage;
              console.log(`[useVideoStream] Metadata for ${deviceId}:`, metaMsg.data);
            }
            // Handle stream paused acknowledgment
            else if (message.type === 'stream.paused') {
              console.log(`[useVideoStream] ✓ Stream paused for ${deviceId}`);
              // Reset error count on successful pause/resume cycle
              connectionStateRef.current.errorCount = 0;
            }
            // Handle stream resumed acknowledgment
            else if (message.type === 'stream.resumed') {
              console.log(`[useVideoStream] ✓ Stream resumed for ${deviceId}`);
              // Reset error count on successful pause/resume cycle
              connectionStateRef.current.errorCount = 0;
            }
            // Handle mode change message (from backend THREAD_BUS notification)
            else if (message.type === 'video.mode_changed') {
              const newMode = message.data?.new_mode;
              console.log(`[useVideoStream] Video mode changed for ${deviceId}: ${newMode}, reconnecting...`);
              // Close connection, component will auto-reconnect with new mode from config
              if (wsRef.current) {
                wsRef.current.close(1000, 'Mode changed, reconnecting');
              }
            }
            // Handle error message
            else if (message.type === 'video.error') {
              const errorMsg = message.data?.error || message.message || `Video stream error for ${deviceId}`;
              const error = new Error(errorMsg);
              console.error(`[useVideoStream] ✗ Stream error for ${deviceId}:`, errorMsg);
              console.error(`[useVideoStream] Full error message:`, message);
              
              // Track error count for recovery
              connectionStateRef.current.errorCount = (connectionStateRef.current.errorCount || 0) + 1;

              // Auto-recovery for decode-related errors
              const isDecodeError = errorMsg.includes('decode') || 
                                   errorMsg.includes('Invalid data') || 
                                   errorMsg.includes('decoder');
              
              if (isDecodeError && connectionStateRef.current.errorCount <= 3) {
                console.log(`[useVideoStream] Attempting to recover from decode error for ${deviceId} (attempt ${connectionStateRef.current.errorCount}/3)...`);
                
                // Send pause then resume to trigger keyframe resend
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  try {
                    // First pause
                    wsRef.current.send(JSON.stringify({ command: 'pause' }));
                    console.log(`[useVideoStream] Sent pause command for recovery`);
                    
                    // Then resume after a short delay to allow backend to flush and resend keyframe
                    setTimeout(() => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ command: 'resume' }));
                        console.log(`[useVideoStream] Sent resume command for recovery`);
                      } else {
                        console.warn(`[useVideoStream] WebSocket not open during recovery resume for ${deviceId}`);
                      }
                    }, 200); // 200ms delay to allow backend to process
                  } catch (e) {
                    console.error(`[useVideoStream] Failed to send recovery commands for ${deviceId}:`, e);
                  }
                } else {
                  console.warn(`[useVideoStream] WebSocket not available for recovery for ${deviceId}`);
                }
              } else if (isDecodeError && connectionStateRef.current.errorCount > 3) {
                console.error(`[useVideoStream] Max recovery attempts reached for ${deviceId}, giving up`);
              }

              connectionStateRef.current.isConnected = false;
              setIsConnected(false);
              onErrorRef.current?.(error);
            } else {
              console.log(`[useVideoStream] Unknown message type for ${deviceId}: ${message.type}`, message);
            }
          } catch (error) {
            console.error(`[useVideoStream] Failed to parse JSON message for ${deviceId}:`, error);
            console.error(`[useVideoStream] Raw message:`, event.data);
          }
        } else {
          console.warn(`[useVideoStream] Unknown message type for ${deviceId}:`, typeof event.data, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error(`[useVideoStream] ✗ WebSocket ERROR for ${deviceId}:`, error);
        console.error(`[useVideoStream] WebSocket readyState: ${ws.readyState}, URL: ${wsUrl}`);
        connectionStateRef.current.isConnecting = false;
        connectionStateRef.current.isConnected = false;
        setIsConnecting(false);
        setIsConnected(false);
        onErrorRef.current?.(new Error(`WebSocket connection error for ${deviceId}`));
      };

      ws.onclose = (event) => {
        console.log(`[useVideoStream] ✗ WebSocket CLOSED for ${deviceId}`);
        console.log(`[useVideoStream] Close code: ${event.code}, reason: ${event.reason || '(no reason)'}, wasClean: ${event.wasClean}`);
        connectionStateRef.current.isConnected = false;
        connectionStateRef.current.isConnecting = false;
        setIsConnected(false);
        setIsConnecting(false);
        
        // If not a clean close, try to reconnect after a delay
        if (!event.wasClean && event.code !== 1000) {
          console.log(`[useVideoStream] Unclean close for ${deviceId}, will not auto-reconnect (component should handle this)`);
        }
      };
    } catch (error) {
      console.error(`[useVideoStream] Failed to connect video stream for ${deviceId}:`, error);
      connectionStateRef.current.isConnecting = false;
      setIsConnecting(false);
      onErrorRef.current?.(error instanceof Error ? error : new Error('Connection failed'));
    }
  }, [deviceId, enabled]);

  // Public connect function that uses props
  const connect = useCallback(async () => {
    await connectInternal(streamType, hwaccel);
  }, [connectInternal, streamType, hwaccel]);

  // Disconnect from video stream
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    connectionStateRef.current.isConnected = false;
    connectionStateRef.current.isConnecting = false;
    connectionStateRef.current.deviceConnected = false;
    setIsConnected(false);
    setIsConnecting(false);
    
    // Note: We don't call device.disconnect here because other components might be using the device
    // The device will be disconnected when all video streams are closed
  }, []);

  // Listen to config changes and auto-reconnect when video_stream_mode changes
  useEffect(() => {
    // Get initial config
    const initialConfig = configService.getConfig();
    if (initialConfig) {
      currentStreamModeRef.current = initialConfig.video_stream_mode;
    }

    // Subscribe to config changes
    const unsubscribe = configService.subscribe((config: GlobalConfig) => {
      const oldMode = currentStreamModeRef.current;
      const newMode = config.video_stream_mode;
      
      // If video stream mode changed and we have an active connection, reconnect
      if (oldMode && oldMode !== newMode && enabled) {
        console.log(`[useVideoStream] Video mode changed for ${deviceId}: ${oldMode} -> ${newMode}, reconnecting...`);
        currentStreamModeRef.current = newMode;
        
        // Close old connection
        if (wsRef.current) {
          console.log(`[useVideoStream] Closing old WebSocket connection for ${deviceId} (mode: ${oldMode})`);
          wsRef.current.close(1000, `Mode changed from ${oldMode} to ${newMode}`);
          wsRef.current = null;
        }
        
        // Reset connection state
        connectionStateRef.current.isConnected = false;
        connectionStateRef.current.isConnecting = false;
        setIsConnected(false);
        setIsConnecting(false);
        
        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Reconnect with new mode after a short delay
        // Use new config values directly instead of waiting for props to update
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log(`[useVideoStream] Reconnecting to new endpoint for ${deviceId} (mode: ${newMode})`);
          reconnectTimeoutRef.current = null;
          // Reconnect using new config values
          connectInternal(newMode, config.hwaccel);
        }, 500);
      } else {
        currentStreamModeRef.current = newMode;
      }
    });

    return () => {
      unsubscribe();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [deviceId, enabled, connectInternal]);

  // Handle page visibility changes to pause/resume stream
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      // Enhanced connection state check
      if (!wsRef.current) {
        console.warn(`[useVideoStream] WebSocket not available for ${deviceId}, skipping pause/resume`);
        return;
      }

      if (wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn(`[useVideoStream] WebSocket not open for ${deviceId} (state: ${wsRef.current.readyState}), skipping pause/resume`);
        return;
      }

      if (document.hidden) {
        // Page is hidden, pause stream
        console.log(`[useVideoStream] Page hidden, pausing stream for ${deviceId}`);
        try {
          wsRef.current.send(JSON.stringify({ command: 'pause' }));
          console.log(`[useVideoStream] ✓ Pause command sent for ${deviceId}`);
        } catch (error) {
          console.error(`[useVideoStream] ✗ Failed to send pause command for ${deviceId}:`, error);
          console.error(`[useVideoStream] WebSocket state: ${wsRef.current.readyState}, URL: ${wsRef.current.url}`);
        }
      } else {
        // Page is visible, resume stream
        console.log(`[useVideoStream] Page visible, resuming stream for ${deviceId}`);
        try {
          wsRef.current.send(JSON.stringify({ command: 'resume' }));
          console.log(`[useVideoStream] ✓ Resume command sent for ${deviceId}`);
        } catch (error) {
          console.error(`[useVideoStream] ✗ Failed to send resume command for ${deviceId}:`, error);
          console.error(`[useVideoStream] WebSocket state: ${wsRef.current.readyState}, URL: ${wsRef.current.url}`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, deviceId]);

  // Auto-connect when enabled (only once per mount/enable change)
  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      connectionStateRef.current.isConnected = false;
      connectionStateRef.current.isConnecting = false;
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    // Only connect if not already connecting or connected
    if (!connectionStateRef.current.isConnecting && !connectionStateRef.current.isConnected) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      connectionStateRef.current.isConnected = false;
      connectionStateRef.current.isConnecting = false;
      setIsConnected(false);
      setIsConnecting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, deviceId, streamType, hwaccel]); // Only depend on props that should trigger reconnection

  return {
    canvasRef,
    isConnected,
    isConnecting,
    streamInfo,
    connect,
    disconnect
  };
}

