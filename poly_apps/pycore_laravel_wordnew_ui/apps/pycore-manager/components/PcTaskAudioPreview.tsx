/**
 * Local cached-audio preview for pycore TaskManager / recent-task records.
 *
 * Playback bytes are fetched through the shared RPC v2 resource route.
 */
import React from 'react';
import { PcBlobAudio } from './PcBlobMedia';

/** Keep the local path opaque; PcBlobAudio transfers its bytes over RPC v2. */
export function buildLocalAudioUrl(audioPath: string): string {
  return audioPath;
}

/** Pull audio_path from a task result or detail object (incl. words[0].audio_path). */
export function extractAudioPath(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const obj = source as Record<string, unknown>;
  const direct = obj.audio_path;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const words = obj.words;
  if (Array.isArray(words) && words.length > 0) {
    const first = words[0];
    if (first && typeof first === 'object') {
      const nested = (first as Record<string, unknown>).audio_path;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return null;
}

interface PcTaskAudioPreviewProps {
  audioPath: string;
  /** Optional heading (defaults to "Audio"). */
  label?: string;
  /** Show file path beneath the player (default true). */
  showPath?: boolean;
}

export const PcTaskAudioPreview: React.FC<PcTaskAudioPreviewProps> = ({
  audioPath,
  label = 'Audio',
  showPath = true,
}) => (
  <div className="space-y-1">
    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    <PcBlobAudio controls preload="none" className="w-full max-w-md" path={buildLocalAudioUrl(audioPath)} />
    {showPath && (
      <p className="text-[10px] font-mono text-slate-400 break-all">{audioPath}</p>
    )}
  </div>
);

export default PcTaskAudioPreview;
