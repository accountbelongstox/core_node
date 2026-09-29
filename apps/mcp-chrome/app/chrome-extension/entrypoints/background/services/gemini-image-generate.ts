/**
 * Shared Gemini web image generation (start -> status poll). The Gemini tool
 * drives ONE gemini.google.com tab and isolates results by a baseline image
 * snapshot, so generations are serialized on the tool's generation mutex: the
 * global-task pull and the assist claim cycle of the Gemini image worker may
 * both ask concurrently, and the interactive tool and popup share the tab.
 * Returns null on ANY failure so callers can fall back to another provider.
 */
import { geminiImageTool } from '../tools/browser/gemini-image';
import { delay as waitForDelay } from '@/utils/async';

const GENERATION_TIMEOUT_MS = 110000;
const POLL_INTERVAL_MS = 3000;
const GENERATION_ABANDONED = 'Generation abandoned before an image was collected';

export interface GeminiGeneratedImage {
  imageBase64: string;
  mime: string;
}

/**
 * Generate one image from a text prompt via the Gemini web tab. Null means:
 * tab unavailable, start refused, generation failed, or timed out — the
 * caller decides the fallback (Google/Bing search, task failure, ...).
 */
export async function generateViaGemini(prompt: string): Promise<GeminiGeneratedImage | null> {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  return geminiImageTool.runExclusive(() => generateOnce(trimmed));
}

async function generateOnce(prompt: string): Promise<GeminiGeneratedImage | null> {
  const started = await geminiImageTool
    .start(prompt, false, GENERATION_TIMEOUT_MS)
    .catch(() => null);
  if (!started?.ok || !started.jobId) return null;

  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  let last: Awaited<ReturnType<typeof geminiImageTool.status>> | null = null;
  while (Date.now() < deadline) {
    await waitForDelay(POLL_INTERVAL_MS);
    last = await geminiImageTool
      .status(started.jobId)
      .catch((error: any) => ({ ok: false, status: 'failed' as const, error: error?.message }));
    if (last.status === 'done' || last.status === 'failed' || last.status === 'unknown') break;
  }

  if (!last || last.status !== 'done' || !last.dataUrl) {
    await geminiImageTool.cancel(started.jobId, last?.error || GENERATION_ABANDONED);
    return null;
  }
  return {
    imageBase64: last.dataUrl.replace(/^data:[^;]+;base64,/, ''),
    mime: last.mime || 'image/png',
  };
}
