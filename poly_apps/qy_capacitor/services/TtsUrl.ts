/**
 * TTS audio URL resolution.
 *
 * Backend may have shipped (and persisted into app state) legacy `audio_url`
 * forms missing the `ai_tools` segment or the route prefix entirely. The single
 * correct serving route is:
 *   {origin}/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}[/{speed}]/{filename}
 * This repairs any known legacy form before playback/download.
 */

import { apiManager } from './ApiManager';

const CANONICAL_PREFIX = '/api/app_qy_v1/ai_tools/tts/audio/';
const MARKER = 'tts/audio/';

export function resolveAudioUrl(audioUrl: string): string {
  if (!audioUrl) return '';

  // Absolute URLs are trusted as-is.
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }

  // Extract the segment after `tts/audio/` when present; otherwise treat the
  // whole value as the relative `{language}/{type}/.../{filename}` tail. This
  // collapses every legacy form (with/without `ai_tools`, raw half-path, bare
  // relative) to one canonical tail, composed with the prefix exactly once.
  const markerIndex = audioUrl.indexOf(MARKER);
  const rest = markerIndex >= 0
    ? audioUrl.slice(markerIndex + MARKER.length)
    : audioUrl.replace(/^\/+/, '');

  const serverRelativePath = `${CANONICAL_PREFIX}${rest}`;
  return `${apiManager.getCurrentBaseUrl()}${serverRelativePath}`;
}
