import React, { useEffect, useState } from 'react';
import { useVideoStream } from '../hooks/useVideoStream';
import { DeviceH264Stream } from './DeviceH264Stream';
import { configService, GlobalConfig } from '../services/configService';

interface DeviceVideoStreamProps {
  deviceId: string; // Device ID for routing (e.g., "device_1")
  enabled: boolean;
  onError?: (error: Error) => void;
  onInit?: (info: { width: number; height: number; fps: number; format: string }) => void;
}

/**
 * Component for rendering device video stream (supports both H.264 and YUV modes)
 * Automatically switches based on global config
 */
export const DeviceVideoStream: React.FC<DeviceVideoStreamProps> = ({
  deviceId,
  enabled,
  onError,
  onInit
}) => {
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [configKey, setConfigKey] = useState(0); // Force re-render when config changes
  const [isPaused, setIsPaused] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Wrap onError to track error state - MUST be defined before useVideoStream
  const handleError = React.useCallback((error: Error) => {
    setHasError(true);
    onError?.(error);
  }, [onError]);

  useEffect(() => {
    // Get initial config
    const config = configService.getConfig();
    if (config) {
      setGlobalConfig(config);
    }

    // Use a ref to track previous mode without causing re-renders
    let prevMode = config?.video_stream_mode;

    // Subscribe to config changes
    const unsubscribe = configService.subscribe((config) => {
      const newMode = config.video_stream_mode;

      // Only force remount if video stream mode actually changed
      if (prevMode && prevMode !== newMode) {
        console.log(`[DeviceVideoStream] Video mode changed for ${deviceId}: ${prevMode} -> ${newMode}, remounting...`);
        setConfigKey(prev => prev + 1); // Force remount by changing key
      }

      prevMode = newMode;
      setGlobalConfig(config);
    });

    return () => {
      unsubscribe();
    };
  }, [deviceId]); // ✅ Remove globalConfig?.video_stream_mode from dependencies

  // Use YUV stream component (only when mode is YUV)
  const { canvasRef, isConnected, isConnecting, streamInfo, connect, disconnect } = useVideoStream({
    deviceId,
    enabled: enabled && globalConfig?.video_stream_mode === 'yuv',
    streamType: 'yuv',
    hwaccel: globalConfig?.hwaccel,
    onError: handleError,
    onInit
  });

  // Touch control state for YUV mode
  const isMouseDownRef = React.useRef(false);
  const lastSendTimeRef = React.useRef(0);
  const [frameSize, setFrameSize] = React.useState({ width: 1080, height: 2340 });

  // Update frame size when stream info changes
  React.useEffect(() => {
    if (streamInfo) {
      console.log(`[YUVStream] Updating frameSize from ${frameSize.width}x${frameSize.height} to ${streamInfo.width}x${streamInfo.height}`);
      setFrameSize({ width: streamInfo.width, height: streamInfo.height });
    }
  }, [streamInfo]);

  // Coordinate transformation: window coords → device coords
  const convertCoordinates = React.useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * frameSize.width);
    const y = Math.floor((clientY - rect.top) / rect.height * frameSize.height);

    return { x, y };
  }, [frameSize, canvasRef]);

  // Send touch event (with throttling)
  const sendTouchEvent = React.useCallback(async (action: 'down' | 'up' | 'move', x: number, y: number) => {
    if (!isConnected) {
      console.warn('[YUVStream] Cannot send touch - not connected');
      return;
    }

    // Event throttling: move events max 60fps (16ms)
    const now = Date.now();
    if (action === 'move' && now - lastSendTimeRef.current < 16) {
      return;
    }
    lastSendTimeRef.current = now;

    try {
      console.log(`[YUVStream] Sending touch ${action} to ${deviceId} at (${x}, ${y}), screen: ${frameSize.width}x${frameSize.height}`);

      // Import wsService dynamically to avoid circular dependencies
      const { wsService } = await import('../services/websocket');

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

      console.log(`[YUVStream] Touch ${action} result:`, result);

      if (result?.error) {
        console.error('[YUVStream] Touch event error:', result.error);
      }
    } catch (error) {
      console.error('[YUVStream] Failed to send touch event:', error);
    }
  }, [deviceId, isConnected, frameSize]);

  // Mouse event handlers for YUV mode
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    console.log('[YUVStream] ========== MOUSE DOWN EVENT FIRED ==========');
    console.log('[YUVStream] Client position:', e.clientX, e.clientY);
    console.log('[YUVStream] Button:', e.button);

    e.preventDefault();
    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) {
      console.warn('[YUVStream] [X] Failed to convert coordinates on mouseDown');
      return;
    }

    console.log(`[YUVStream] Mouse down at client(${e.clientX}, ${e.clientY}) -> device(${coords.x}, ${coords.y})`);
    console.log(`[YUVStream] isConnected: ${isConnected}, frameSize: ${frameSize.width}x${frameSize.height}`);

    isMouseDownRef.current = true;
    sendTouchEvent('down', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent, isConnected, frameSize]);

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;

    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    sendTouchEvent('move', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent]);

  const handleMouseUp = React.useCallback((e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;

    const coords = convertCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    isMouseDownRef.current = false;
    sendTouchEvent('up', coords.x, coords.y);
  }, [convertCoordinates, sendTouchEvent]);

  const handleMouseLeave = React.useCallback(() => {
    if (isMouseDownRef.current) {
      console.log('[YUVStream] Mouse left canvas while dragging, auto-releasing touch');
      isMouseDownRef.current = false;
    }
  }, []);

  // Reset error state when connection is restored
  useEffect(() => {
    if (isConnected) {
      setHasError(false);
    }
  }, [isConnected]);

  // Track page visibility for pause indicator
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  // Render based on video stream mode
  // CRITICAL: Use single consistent key to prevent unmount/remount on state changes
  if (globalConfig?.video_stream_mode === 'h264') {
    // Render H.264 stream once with consistent key - never unmount on state changes
    return (
      <DeviceH264Stream
        key={`h264-${deviceId}-${configKey}`}
        deviceId={deviceId}
        enabled={enabled}
        onError={onError}
        onInit={onInit}
        showAsBackground={false}
      />
    );
  }

  // YUV mode
  if (isConnected) {
    return (
      <div className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover cursor-crosshair"
          style={{ display: 'block', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Error Indicator with Reconnect Button - ONLY shown on error */}
        {hasError && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto z-10">
            <div className="text-center p-4">
              <div className="text-[#ff2a6d] text-sm font-mono mb-2">
                <i className="ph ph-warning text-xl"></i>
              </div>
              <div className="text-white/90 text-xs font-mono mb-4">
                Stream Error
              </div>
              <button
                onClick={() => {
                  setHasError(false);
                  disconnect();
                  setTimeout(() => {
                    connect();
                  }, 100);
                }}
                className="px-4 py-2 bg-[#00f2ff]/20 hover:bg-[#00f2ff]/30 border border-[#00f2ff]/50 text-[#00f2ff] rounded transition-colors text-xs font-mono"
              >
                <i className="ph ph-arrow-clockwise mr-2"></i>
                Reconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // YUV mode connecting state
  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center p-4 pointer-events-none">
      {/* Canvas MUST be visible (not display:none) for WebGL to initialize correctly */}
      {/* Place canvas in background, overlay loading UI on top */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: 'block', zIndex: 0 }}
      />

      {/* Overlay loading UI */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}></div>

        {/* Central Spinner */}
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00f2ff] animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-l-[#bd00ff] animate-[spin_1.5s_linear_infinite_reverse]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="ph-fill ph-lightning text-[#00f2ff] text-xl animate-pulse"></i>
          </div>
        </div>

        {/* Status Text */}
        <div className="font-mono text-[9px] text-[#00f2ff] tracking-[2px] mb-2 animate-pulse">
          {isConnecting ? 'Connecting...' : 'Waiting...'}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00f2ff] via-[#bd00ff] to-[#00f2ff] w-[60%] animate-[shimmer_1.5s_infinite]"></div>
        </div>
      </div>
    </div>
  );
};

