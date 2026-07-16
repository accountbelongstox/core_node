/**
 * Locate the embedded Gradio iframe inside a HuggingFace Space tab.
 */

import { QWEN_TTS_GRADIO_HOST, QWEN_TTS_SPACE_URL } from '@/utils/qwen-tts-core';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isGradioAppUrl(url: string | undefined | null): boolean {
  return !!url && url.includes(QWEN_TTS_GRADIO_HOST);
}

/** Poll all frames until the qwen-qwen3-tts.hf.space iframe is ready. */
export async function waitForGradioFrame(tabId: number, timeoutMs = 90_000): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => ({
        host: location.hostname,
        href: location.href,
        ready: document.readyState,
        hasGenerate: !!Array.from(document.querySelectorAll('button')).find(
          (b) => (b.textContent || '').trim() === 'Generate with Custom Voice',
        ),
      }),
    });

    for (const hit of results) {
      const info = hit.result as { host?: string; href?: string; ready?: string; hasGenerate?: boolean };
      if (!info?.host?.includes(QWEN_TTS_GRADIO_HOST)) continue;
      if (info.ready === 'complete' || info.hasGenerate) {
        return hit.frameId;
      }
    }
    await sleep(1200);
  }
  throw new Error(
    `Gradio iframe not ready on ${QWEN_TTS_SPACE_URL} — open the Space tab and wait for the demo to load`,
  );
}

/** Main frame when the tab is already the direct Gradio app URL. */
export function gradioFrameForTabUrl(tabUrl: string | undefined | null): number | null {
  return isGradioAppUrl(tabUrl) ? 0 : null;
}
