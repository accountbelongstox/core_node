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
  const connectionStateRef = useRef({ isConnecting: false, isConnected: false, deviceConnected: false });
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
      const connectResult = await wsService.request('device.connect', { deviceId });
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
          console.log(`[useVideoStream] Binary frame received for ${deviceId}, size: ${event.data.byteLength} bytes`);
          
          if (targetStreamType === 'yuv') {
            if (!rendererRef.current) {
              console.warn(`[useVideoStream] No WebGL renderer for ${deviceId}, cannot render frame`);
              return;
            }
            
            try {
              const data = new Uint8Array(event.data);
              console.log(`[useVideoStream] Parsing YUV frame for ${deviceId}, total size: ${data.length} bytes`);
              
              // Parse YUV frame protocol according to API_DOCUMENTATION.md:
              // [serial_len(1)][serial(N)][pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)][Y data][U data][V data]
              // Note: frameSerial from backend is the actual device serial, not deviceId
              
              let offset = 0;
              
              // Read serial length (backend sends actual serial in frame, not deviceId)
              const serialLen = data[offset++];
              console.log(`[useVideoStream] Frame serial length: ${serialLen}, offset: ${offset}`);
              
              if (serialLen === 0 || offset + serialLen > data.length) {
                console.warn(`[useVideoStream] Invalid serial length for ${deviceId}: ${serialLen}, data length: ${data.length}`);
                return;
              }
              
              // Extract serial (backend sends actual serial, we can log it but don't need to verify against deviceId)
              const frameSerial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
              offset += serialLen;
              console.log(`[useVideoStream] Frame serial: ${frameSerial} (deviceId: ${deviceId})`);
              
              // Note: We don't verify frameSerial against deviceId because:
              // - deviceId is a frontend abstraction (e.g., "device_1")
              // - frameSerial is the actual device serial from backend (e.g., "ABC123" or "192.168.50.44:5555")
              // Backend already ensures frames are routed to correct WebSocket connection
              
              // Parse frame header (big-endian as per protocol)
              // Protocol: [pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)]
              const view = new DataView(event.data, offset);
              const pts = view.getBigUint64(0, false); // big-endian (false = big-endian)
              const width = view.getUint16(8, false); // big-endian
              const height = view.getUint16(10, false); // big-endian
              const ySize = view.getInt32(12, false); // big-endian (signed as per backend)
              const uSize = view.getInt32(16, false); // big-endian (signed as per backend)
              const vSize = view.getInt32(20, false); // big-endian (signed as per backend)

              console.log(`[useVideoStream] Frame header for ${deviceId}: width=${width}, height=${height}, ySize=${ySize}, uSize=${uSize}, vSize=${vSize}, pts=${pts}`);

              offset += 24; // Header size: 8 + 2 + 2 + 4 + 4 + 4 = 24 bytes

              // Calculate strides (linesize) - YUV420P format
              // For YUV420P: Y plane is full resolution, U/V planes are half resolution
              // ySize should be yStride * height, uSize should be uStride * (height/2), etc.
              const yStride = Math.floor(ySize / height);
              const uStride = Math.floor(uSize / (height / 2));
              const vStride = Math.floor(vSize / (height / 2));

              console.log(`[useVideoStream] Calculated strides for ${deviceId}: yStride=${yStride}, uStride=${uStride}, vStride=${vStride}`);
              console.log(`[useVideoStream] Expected strides: Y=${width}, U=${width/2}, V=${width/2}`);

              // Verify data sizes
              const expectedTotalSize = ySize + uSize + vSize;
              if (offset + expectedTotalSize > data.length) {
                console.warn(`[useVideoStream] Invalid frame data size for ${deviceId}: expected ${offset + expectedTotalSize}, got ${data.length}`);
                return;
              }

              // Extract YUV planes
              const yPlane = new Uint8Array(data.buffer, data.byteOffset + offset, ySize);
              offset += ySize;
              const uPlane = new Uint8Array(data.buffer, data.byteOffset + offset, uSize);
              offset += uSize;
              const vPlane = new Uint8Array(data.buffer, data.byteOffset + offset, vSize);

              console.log(`[useVideoStream] Extracted YUV planes for ${deviceId}: Y=${yPlane.length}, U=${uPlane.length}, V=${vPlane.length}`);

              // Render frame WITH stride information (critical for correct rendering)
              try {
                rendererRef.current.renderFrame(
                  yPlane,
                  uPlane,
                  vPlane,
                  width,
                  height,
                  yStride, // Y linesize
                  uStride, // U linesize
                  vStride  // V linesize
                );
                console.log(`[useVideoStream] ✓ Frame rendered for ${deviceId} (${width}x${height}, strides: ${yStride}/${uStride}/${vStride})`);
              } catch (renderError) {
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

