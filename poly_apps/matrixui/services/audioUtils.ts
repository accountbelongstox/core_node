import { Blob } from '@google/genai';

export const float32To16BitPCM = (float32Arr: Float32Array): Int16Array => {
  const l = float32Arr.length;
  const int16Arr = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]));
    int16Arr[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Arr;
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const createPcmBlob = (data: Float32Array): Blob => {
  const int16 = float32To16BitPCM(data);
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const decodeAudioData = async (
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  const arrayBuffer = base64ToArrayBuffer(base64Data);
  const dataInt16 = new Int16Array(arrayBuffer);
  const numChannels = 1;
  const frameCount = dataInt16.length;
  
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return audioBuffer;
};