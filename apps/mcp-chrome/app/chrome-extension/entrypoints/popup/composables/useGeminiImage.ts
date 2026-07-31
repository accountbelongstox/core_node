/**
 * Gemini image-generation composable (popup).
 * One call drives the background geminiImageTool: open/reuse a Gemini tab,
 * submit the prompt, and return the generated image as a base64 data URL.
 */
import { ref } from 'vue';
import { logger } from '@/utils/logger';
import { sendWithWake } from '@/utils/sendWithWake';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { getMessage } from '@/utils/i18n';

const LOG = 'Gemini Client';

// A ready-to-use example prompt (the user asked for one). Edit freely.
export const DEFAULT_GEMINI_PROMPT =
  'A serene Japanese garden at sunrise — koi pond, stone lantern, cherry blossoms, soft morning mist, photorealistic, cinematic lighting, 16:9';

export interface GeminiImageOutput {
  success: boolean;
  prompt: string;
  dataUrl: string | null;
  mime: string | null;
  width?: number;
  height?: number;
  src?: string | null;
  error: string | null;
}

// Poll cadence + ceiling for the async status loop.
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60; // ~3 min

export function useGeminiImage() {
  const prompt = ref(DEFAULT_GEMINI_PROMPT);
  const generating = ref(false);
  const error = ref('');
  // Human-facing phase shown on the button while working.
  const phase = ref('');
  const result = ref<GeminiImageOutput | null>(null);
  // Reuse the existing Gemini tab by default; opt in to a fresh tab per run.
  const openInNewTab = ref(false);

  const send = (msg: Record<string, any>) =>
    chrome.runtime.sendMessage({ type: FEATURE_MESSAGE_TYPES.GEMINI_IMAGE, ...msg });

  // Two-phase async flow: start (returns a jobId fast) then poll status until
  // the image is ready — so neither the popup nor the bridge blocks for minutes.
  const generate = async () => {
    const p = prompt.value.trim();
    if (!p) {
      error.value = getMessage('enterPromptFirst');
      return;
    }
    generating.value = true;
    error.value = '';
    result.value = null;
    phase.value = 'Submitting…';
    try {
      const startResp = await sendWithWake(
        () => send({ action: 'start', prompt: p, openInNewTab: openInNewTab.value, timeoutMs: 180000 }),
        'Gemini',
      );
      const jobId = startResp?.result?.jobId;
      if (!startResp?.success || !jobId) {
        error.value = startResp?.result?.error || startResp?.error || getMessage('generationStartFailed');
        generating.value = false;
        phase.value = '';
        return;
      }

      phase.value = 'Generating…';
      let polls = 0;
      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        polls++;
        const s = await send({ action: 'status', jobId });
        const res = s?.result;
        if (!res) continue;
        if (res.status === 'done') {
          result.value = res;
          phase.value = '';
          generating.value = false;
          return;
        }
        if (res.status === 'failed' || res.status === 'unknown') {
          error.value = res.error || getMessage('generationFailed');
          phase.value = '';
          generating.value = false;
          return;
        }
        // still generating → keep polling
      }
      error.value = getMessage('imageGenerationTimeout');
      phase.value = '';
      generating.value = false;
    } catch (e: any) {
      error.value = e?.message || getMessage('generationFailed');
      logger.error(LOG, 'generate failed', e);
      phase.value = '';
      generating.value = false;
    }
  };

  /** Save the generated image to disk via a temporary download anchor. */
  const download = () => {
    const r = result.value;
    if (!r?.dataUrl) return;
    const ext = (r.mime && r.mime.split('/')[1]) || 'png';
    const a = document.createElement('a');
    a.href = r.dataUrl;
    a.download = `gemini-image.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return { prompt, generating, phase, error, result, openInNewTab, generate, download };
}
