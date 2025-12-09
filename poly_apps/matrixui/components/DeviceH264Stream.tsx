import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const [browserSupport, setBrowserSupport] = useState<{
    webcodecs: boolean;
    canvas2d: boolean;
    webgl: boolean;
  } | null>(null);

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

  useEffect(() => {
    if (!enabled || !browserSupport?.webcodecs) return;

    console.log(`[H264Stream] Creating WebSocket for ${deviceId}`);
    const ws = new WebSocket(`ws://localhost:48000/video/${deviceId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[H264Stream] WebSocket opened for ${deviceId}`);
      ws.send(JSON.stringify({ command: 'start_stream', device_id: deviceId }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleFrame(event.data);
      } else if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stream_started') {
          console.log(`[H264Stream] Stream started for ${deviceId}`);
          setIsConnected(true);
        }
      }
    };

    ws.onerror = (err) => {
      console.error(`[H264Stream] WebSocket error for ${deviceId}:`, err);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log(`[H264Stream] WebSocket closed for ${deviceId}`);
      setIsConnected(false);
    };

    return () => {
      console.log(`[H264Stream] Cleaning up ${deviceId}`);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
        decoderConfigured.current = false;
      }
      setIsConnected(false);
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
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ display: 'block' }} />
      {isConnected && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-[9px] font-mono text-blue-400">
          H.264 CONNECTED
        </div>
      )}
      {browserSupport && !browserSupport.webgl && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-[9px] font-mono text-yellow-400">
          WebGL Disabled
        </div>
      )}
    </div>
  );
};
