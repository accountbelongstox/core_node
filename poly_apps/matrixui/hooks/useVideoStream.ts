import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLYUVRenderer } from '../utils/WebGLYUVRenderer';
import { wsService } from '../services/websocket';

interface VideoStreamOptions {
  serial: string;
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
  serial, 
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
      console.error(`[useVideoStream] Failed to initialize WebGL renderer for ${serial}:`, error);
      onError?.(error instanceof Error ? error : new Error('WebGL initialization failed'));
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [enabled, streamType, serial, onError]);

  // Connect to video stream
  const connect = useCallback(async () => {
    // Use ref to check state without causing dependency issues
    if (!enabled || connectionStateRef.current.isConnecting || connectionStateRef.current.isConnected) {
      console.log(`[useVideoStream] Skipping connect for ${serial}: enabled=${enabled}, isConnecting=${connectionStateRef.current.isConnecting}, isConnected=${connectionStateRef.current.isConnected}`);
      return;
    }
    
    console.log(`[useVideoStream] Starting connection for ${serial} (streamType=${streamType})`);
    connectionStateRef.current.isConnecting = true;
    setIsConnecting(true);
    
    try {
      // First, connect device via RPC v2
      console.log(`[useVideoStream] Checking RPC connection for ${serial}...`);
      if (!wsService.isRpcConnected()) {
        console.log(`[useVideoStream] RPC not connected, connecting...`);
        await wsService.connectRpc();
        console.log(`[useVideoStream] RPC connected`);
      } else {
        console.log(`[useVideoStream] RPC already connected`);
      }
      
      // Check if device is already connected (avoid duplicate device.connect calls)
      const deviceAlreadyConnected = deviceConnectMapRef.current.get(serial);
      console.log(`[useVideoStream] Device ${serial} connection status: ${deviceAlreadyConnected ? 'already connected' : 'needs connection'}`);
      
      if (!deviceAlreadyConnected) {
        try {
          console.log(`[useVideoStream] Calling device.connect for ${serial}...`);
          // Start video stream via device.connect (only once per device)
          const connectResult = await wsService.callRpc('device.connect', {
            serial,
            max_size: 720,
            bit_rate: 8000000
          });
          console.log(`[useVideoStream] device.connect result for ${serial}:`, connectResult);
          deviceConnectMapRef.current.set(serial, true);
          console.log(`[useVideoStream] ✓ Device ${serial} connected via device.connect`);
        } catch (error) {
          console.error(`[useVideoStream] device.connect error for ${serial}:`, error);
          // If device is already connected or timeout, that's okay - try video stream anyway
          if (error instanceof Error && (
            error.message.includes('already connected') ||
            error.message.includes('already exists') ||
            error.message.includes('timed out') ||
            error.message.includes('timeout')
          )) {
            deviceConnectMapRef.current.set(serial, true);
            console.log(`[useVideoStream] Device ${serial} connect failed/timeout, but will try video stream anyway (device may already be connected)`);
          } else {
            // Only throw for unexpected errors
            console.error(`[useVideoStream] Unexpected error during device.connect for ${serial}, will still try video stream:`, error);
          }
        }
      } else {
        console.log(`[useVideoStream] Skipping device.connect for ${serial} (already connected)`);
      }
      
      // Wait a bit for device to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Build WebSocket URL based on stream type
      // NOTE: Backend uses /ws/video/{serial} for H.264, YUV endpoint may not be implemented yet
      let wsUrl: string;
      if (streamType === 'yuv') {
        // Try YUV endpoint first (may not exist yet)
        wsUrl = `ws://localhost:48000/video/yuv/${encodeURIComponent(serial)}`;
        if (hwaccel) {
          wsUrl += `?hwaccel=${hwaccel}`;
        }
        console.log(`[useVideoStream] Using YUV endpoint: ${wsUrl}`);
        console.log(`[useVideoStream] NOTE: If this fails, YUV endpoint may not be implemented. Falling back to H.264.`);
      } else {
        // H.264 stream endpoint: ws://localhost:48000/ws/video/{serial}
        wsUrl = `ws://localhost:48000/ws/video/${encodeURIComponent(serial)}`;
        console.log(`[useVideoStream] Using H.264 endpoint: ${wsUrl}`);
      }
      
      console.log(`[useVideoStream] Connecting to ${streamType} stream for ${serial}`);
      console.log(`[useVideoStream] WebSocket URL: ${wsUrl}`);
      console.log(`[useVideoStream] WebGL renderer ready: ${rendererRef.current ? 'yes' : 'no'}`);
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      
      console.log(`[useVideoStream] WebSocket created for ${serial}, readyState: ${ws.readyState}`);

      ws.onopen = () => {
        console.log(`[useVideoStream] ✓ WebSocket OPENED for ${serial} (streamType=${streamType})`);
        console.log(`[useVideoStream] WebSocket readyState: ${ws.readyState}, protocol: ${ws.protocol}`);
        connectionStateRef.current.isConnected = true;
        connectionStateRef.current.isConnecting = false;
        setIsConnected(true);
        setIsConnecting(false);
        console.log(`[useVideoStream] Waiting for video.init message...`);
      };

      ws.onmessage = (event) => {
        console.log(`[useVideoStream] Received message for ${serial}, type: ${event.data instanceof ArrayBuffer ? 'binary' : typeof event.data}, size: ${event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.length}`);
        
        // Handle binary YUV/H.264 data
        if (event.data instanceof ArrayBuffer) {
          console.log(`[useVideoStream] Binary frame received for ${serial}, size: ${event.data.byteLength} bytes`);
          
          if (streamType === 'yuv') {
            if (!rendererRef.current) {
              console.warn(`[useVideoStream] No WebGL renderer for ${serial}, cannot render frame`);
              return;
            }
            
            try {
              const data = new Uint8Array(event.data);
              console.log(`[useVideoStream] Parsing YUV frame for ${serial}, total size: ${data.length} bytes`);
              
              // Parse YUV frame protocol according to API_DOCUMENTATION.md:
              // [serial_len(1)][serial(N)][pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)][Y data][U data][V data]
              
              let offset = 0;
              
              // Read serial length and verify it matches our device
              const serialLen = data[offset++];
              console.log(`[useVideoStream] Frame serial length: ${serialLen}, offset: ${offset}`);
              
              if (serialLen === 0 || offset + serialLen > data.length) {
                console.warn(`[useVideoStream] Invalid serial length for ${serial}: ${serialLen}, data length: ${data.length}`);
                return;
              }
              
              // Extract and verify serial
              const frameSerial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
              offset += serialLen;
              console.log(`[useVideoStream] Frame serial: ${frameSerial}, expected: ${serial}`);
              
              // Verify this frame belongs to our device
              if (frameSerial !== serial) {
                console.warn(`[useVideoStream] Frame serial mismatch: expected ${serial}, got ${frameSerial}`);
                return;
              }
              
              // Parse frame header (big-endian as per protocol)
              // Protocol: [pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)]
              const view = new DataView(event.data, offset);
              const pts = view.getBigUint64(0, false); // big-endian (false = big-endian)
              const width = view.getUint16(8, false); // big-endian
              const height = view.getUint16(10, false); // big-endian
              const ySize = view.getInt32(12, false); // big-endian (signed as per backend)
              const uSize = view.getInt32(16, false); // big-endian (signed as per backend)
              const vSize = view.getInt32(20, false); // big-endian (signed as per backend)

              console.log(`[useVideoStream] Frame header for ${serial}: width=${width}, height=${height}, ySize=${ySize}, uSize=${uSize}, vSize=${vSize}, pts=${pts}`);

              offset += 24; // Header size: 8 + 2 + 2 + 4 + 4 + 4 = 24 bytes

              // Calculate strides (linesize) - YUV420P format
              // For YUV420P: Y plane is full resolution, U/V planes are half resolution
              // ySize should be yStride * height, uSize should be uStride * (height/2), etc.
              const yStride = Math.floor(ySize / height);
              const uStride = Math.floor(uSize / (height / 2));
              const vStride = Math.floor(vSize / (height / 2));

              console.log(`[useVideoStream] Calculated strides for ${serial}: yStride=${yStride}, uStride=${uStride}, vStride=${vStride}`);
              console.log(`[useVideoStream] Expected strides: Y=${width}, U=${width/2}, V=${width/2}`);

              // Verify data sizes
              const expectedTotalSize = ySize + uSize + vSize;
              if (offset + expectedTotalSize > data.length) {
                console.warn(`[useVideoStream] Invalid frame data size for ${serial}: expected ${offset + expectedTotalSize}, got ${data.length}`);
                return;
              }

              // Extract YUV planes
              const yPlane = new Uint8Array(data.buffer, data.byteOffset + offset, ySize);
              offset += ySize;
              const uPlane = new Uint8Array(data.buffer, data.byteOffset + offset, uSize);
              offset += uSize;
              const vPlane = new Uint8Array(data.buffer, data.byteOffset + offset, vSize);

              console.log(`[useVideoStream] Extracted YUV planes for ${serial}: Y=${yPlane.length}, U=${uPlane.length}, V=${vPlane.length}`);

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
                console.log(`[useVideoStream] ✓ Frame rendered for ${serial} (${width}x${height}, strides: ${yStride}/${uStride}/${vStride})`);
              } catch (renderError) {
                console.error(`[useVideoStream] Render error for ${serial}:`, renderError);
                console.error(`[useVideoStream] Render error details:`, renderError instanceof Error ? renderError.stack : renderError);
              }
            } catch (error) {
              console.error(`[useVideoStream] Failed to parse YUV frame for ${serial}:`, error);
              console.error(`[useVideoStream] Error details:`, error instanceof Error ? error.stack : error);
            }
          } else if (streamType === 'h264') {
            // TODO: Implement H.264 decoding (WebCodecs API or MSE)
            console.warn(`[useVideoStream] H.264 stream not yet implemented for ${serial}, received ${event.data.byteLength} bytes`);
          }
        } 
        // Handle JSON messages (init, metadata, errors, etc.)
        else if (typeof event.data === 'string') {
          console.log(`[useVideoStream] JSON message received for ${serial}:`, event.data.substring(0, 200));
          try {
            const message = JSON.parse(event.data);
            console.log(`[useVideoStream] Parsed message type: ${message.type} for ${serial}`);
            
            // Handle initialization message
            if (message.type === 'video.init') {
              const initMsg = message as VideoInitMessage;
              const info = {
                width: initMsg.data.width,
                height: initMsg.data.height,
                fps: initMsg.data.fps,
                format: initMsg.data.format || initMsg.data.codec
              };
              console.log(`[useVideoStream] ✓ Stream initialized for ${serial}:`, info);
              setStreamInfo(info);
              onInitRef.current?.(info);
            }
            // Handle metadata message
            else if (message.type === 'video.metadata') {
              const metaMsg = message as VideoMetadataMessage;
              console.log(`[useVideoStream] Metadata for ${serial}:`, metaMsg.data);
            }
            // Handle error message
            else if (message.type === 'video.error') {
              const errorMsg = message.data?.error || message.message || `Video stream error for ${serial}`;
              const error = new Error(errorMsg);
              console.error(`[useVideoStream] ✗ Stream error for ${serial}:`, errorMsg);
              console.error(`[useVideoStream] Full error message:`, message);
              connectionStateRef.current.isConnected = false;
              setIsConnected(false);
              onErrorRef.current?.(error);
            } else {
              console.log(`[useVideoStream] Unknown message type for ${serial}: ${message.type}`, message);
            }
          } catch (error) {
            console.error(`[useVideoStream] Failed to parse JSON message for ${serial}:`, error);
            console.error(`[useVideoStream] Raw message:`, event.data);
          }
        } else {
          console.warn(`[useVideoStream] Unknown message type for ${serial}:`, typeof event.data, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error(`[useVideoStream] ✗ WebSocket ERROR for ${serial}:`, error);
        console.error(`[useVideoStream] WebSocket readyState: ${ws.readyState}, URL: ${wsUrl}`);
        connectionStateRef.current.isConnecting = false;
        connectionStateRef.current.isConnected = false;
        setIsConnecting(false);
        setIsConnected(false);
        onErrorRef.current?.(new Error(`WebSocket connection error for ${serial}`));
      };

      ws.onclose = (event) => {
        console.log(`[useVideoStream] ✗ WebSocket CLOSED for ${serial}`);
        console.log(`[useVideoStream] Close code: ${event.code}, reason: ${event.reason || '(no reason)'}, wasClean: ${event.wasClean}`);
        connectionStateRef.current.isConnected = false;
        connectionStateRef.current.isConnecting = false;
        setIsConnected(false);
        setIsConnecting(false);
        
        // If not a clean close, try to reconnect after a delay
        if (!event.wasClean && event.code !== 1000) {
          console.log(`[useVideoStream] Unclean close for ${serial}, will not auto-reconnect (component should handle this)`);
        }
      };
    } catch (error) {
      console.error(`[useVideoStream] Failed to connect video stream for ${serial}:`, error);
      connectionStateRef.current.isConnecting = false;
      setIsConnecting(false);
      onErrorRef.current?.(error instanceof Error ? error : new Error('Connection failed'));
    }
  }, [serial, enabled, streamType, hwaccel]);

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
  }, [enabled, serial, streamType, hwaccel]); // Only depend on props that should trigger reconnection

  return {
    canvasRef,
    isConnected,
    isConnecting,
    streamInfo,
    connect,
    disconnect
  };
}

