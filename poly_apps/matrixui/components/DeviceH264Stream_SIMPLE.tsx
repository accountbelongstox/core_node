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

  useEffect(() => {
    if (!enabled || isConnected) return;

    const ws = new WebSocket(`ws://localhost:48000/video/${deviceId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ command: 'start_stream', device_id: deviceId }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleFrame(event.data);
      } else if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stream_started') {
          setIsConnected(true);
        }
      }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);

    return () => {
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
    };
  }, [enabled, deviceId, isConnected]);

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

    // Config frame - configure decoder
    if (isConfig) {
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
      return;
    }

    try {
      const avccData = convertToAvcc(h264Data);
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: pts,
        data: avccData
      });
      decoderRef.current.decode(chunk);
    } catch (e) {
      console.error('Decode error:', e);
      decoderConfigured.current = false;
    }
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
      error: (e) => console.error('Decoder error:', e)
    });

    decoderConfigured.current = false;
  }

  function configureDecoder(data: Uint8Array) {
    if (!decoderRef.current) return;

    const nalus = extractNalus(data);
    const sps = nalus.filter(n => (n[0] & 0x1f) === 7);
    const pps = nalus.filter(n => (n[0] & 0x1f) === 8);
    if (!sps.length || !pps.length) return;

    const avcc = buildAvcc(sps, pps);
    const codec = getCodec(sps[0]);

    try {
      decoderRef.current.configure({
        codec,
        description: avcc.buffer,
        hardwareAcceleration: 'prefer-hardware'
      });
      decoderConfigured.current = true;
      console.log('Decoder configured:', codec);
    } catch (e) {
      console.error('Configure error:', e);
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

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ display: 'block' }} />
      {isConnected && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-[9px] font-mono text-blue-400">
          H.264 CONNECTED
        </div>
      )}
    </div>
  );
};
