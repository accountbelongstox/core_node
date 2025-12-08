import React from 'react';
import { useVideoStream } from '../hooks/useVideoStream';

interface DeviceVideoStreamProps {
  serial: string;
  enabled: boolean;
  streamType?: 'h264' | 'yuv';
  hwaccel?: 'cuda' | 'qsv' | 'dxva2' | 'vaapi' | 'auto';
  onError?: (error: Error) => void;
  onInit?: (info: { width: number; height: number; fps: number; format: string }) => void;
}

/**
 * Component for rendering device video stream using WebGL
 */
export const DeviceVideoStream: React.FC<DeviceVideoStreamProps> = ({ 
  serial, 
  enabled,
  streamType = 'yuv',
  hwaccel,
  onError,
  onInit
}) => {
  const { canvasRef, isConnected, isConnecting, streamInfo } = useVideoStream({
    serial,
    enabled,
    streamType,
    hwaccel,
    onError,
    onInit
  });

  if (!enabled) {
    return null;
  }

  if (isConnected && streamType === 'yuv') {
    return (
      <div className="w-full h-full relative">
        <canvas 
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ display: 'block' }}
        />
        <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-[9px] font-mono text-green-400">
          {streamInfo ? `${streamInfo.width}x${streamInfo.height} @ ${streamInfo.fps}fps` : 'VIDEO CONNECTED'}
        </div>
      </div>
    );
  }
  
  if (isConnected && streamType === 'h264') {
    // TODO: Implement H.264 video element rendering
    return (
      <div className="w-full h-full relative flex items-center justify-center bg-black">
        <div className="text-slate-500 text-xs font-mono">
          H.264 stream (not yet implemented)
        </div>
      </div>
    );
  }

  // Show "establishing connection" state
  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center p-4 pointer-events-none">
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
        {isConnecting ? '建立连接中...' : '等待连接...'}
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#00f2ff] via-[#bd00ff] to-[#00f2ff] w-[60%] animate-[shimmer_1.5s_infinite]"></div>
      </div>
      
      {/* Hidden canvas for WebGL initialization */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

