/**
 * ChatGPT web automation tool (chrome_chatgpt).
 *
 * Drives the user's live chatgpt.com tab: types a prompt, submits, waits for the
 * streamed assistant reply to stabilize, extracts its text, optionally captures
 * the "Read aloud" TTS audio, and uploads that audio binary to the Laravel
 * backend. Reuses an existing chatgpt.com tab when present (the currently-running
 * browser) and only opens a new one as a fallback.
 *
 * The page-context functions are self-contained (passed to executeScript), use
 * resilient selectors (data-testid / aria-label / role / contenteditable, never
 * obfuscated generated classes), and return audio as a plain number[] of bytes.
 */
import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import {
  resolveBackendBase,
  waitForTabComplete,
  findOrCreateProviderTab,
  uploadReplyAudio,
  shortHash,
  type ReplyAudio,
} from './ai-web-common';

const CHATGPT_URL = 'https://chatgpt.com/';
const CHATGPT_HOST = 'chatgpt.com';

/** Page-context: send a prompt and return the stabilized assistant reply text. */
const pageSendAndExtract = async (prompt: string, timeoutMs: number) => {
  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  const input =
    q('#prompt-textarea[contenteditable="true"]') ||
    q('div#prompt-textarea') ||
    q('textarea#prompt-textarea') ||
    q('textarea[data-id]') ||
    q('main textarea') ||
    q('textarea');
  if (!input) {
    return { success: false, error: 'ChatGPT input not found (are you logged in?)' };
  }

  const beforeCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;

  input.focus();
  if (input.tagName === 'TEXTAREA') {
    (input as HTMLTextAreaElement).value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // ProseMirror contenteditable.
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, prompt);
    } catch {
      inserted = false;
    }
    if (!inserted || !(input.innerText || '').trim()) {
      input.textContent = prompt;
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
      );
    }
  }

  await new Promise((r) => setTimeout(r, 250));

  const sendBtn =
    (q('button[data-testid="send-button"]') as HTMLButtonElement | null) ||
    (q('button[aria-label*="Send" i]') as HTMLButtonElement | null);
  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
  } else {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
    );
  }

  const start = Date.now();
  let last = '';
  let stable = 0;
  let answer = '';
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 800));
    const blocks = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (blocks.length <= beforeCount) continue;
    const el = blocks[blocks.length - 1] as HTMLElement;
    const txt = (el.innerText || '').trim();
    if (txt && txt === last) {
      stable += 1;
      if (stable >= 3) {
        answer = txt;
        break;
      }
    } else {
      stable = 0;
      last = txt;
    }
  }

  if (!answer) {
    return { success: false, error: 'Timed out waiting for ChatGPT reply', partial: last };
  }
  return { success: true, answer };
};

/** Page-context: trigger "Read aloud" and best-effort capture the audio bytes. */
const pageExtractAudio = async (timeoutMs: number) => {
  const btns = document.querySelectorAll(
    'button[data-testid="voice-play-turn-action-button"], button[aria-label*="Read aloud" i], button[aria-label*="朗读" i]',
  );
  if (btns.length > 0) {
    (btns[btns.length - 1] as HTMLButtonElement).click();
  } else {
    return { ok: false, error: 'Read-aloud button not found' };
  }

  const start = Date.now();
  let src = '';
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
    const audios = Array.from(document.querySelectorAll('audio')) as HTMLAudioElement[];
    const a = audios.find((x) => typeof x.src === 'string' && x.src.length > 0);
    if (a) {
      src = a.src;
      break;
    }
  }
  if (!src) {
    return { ok: false, error: 'No audio source appeared (TTS may stream via MSE)' };
  }
  try {
    const resp = await fetch(src);
    const buf = await resp.arrayBuffer();
    const mime = resp.headers.get('content-type') || 'audio/mpeg';
    return { ok: true, mime, bytes: Array.from(new Uint8Array(buf)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

class ChatGptSendPromptTool extends BaseBrowserToolExecutor {
  name = 'chrome_chatgpt';

  async execute(args: {
    prompt: string;
    withAudio?: boolean;
    tabId?: number;
    timeoutMs?: number;
    language?: string;
    apiBaseUrl?: string;
  }): Promise<ToolResult> {
    const { prompt, withAudio = false, tabId, timeoutMs = 120000, language = 'en', apiBaseUrl } = args;

    if (!prompt || prompt.trim().length === 0) {
      return createErrorResponse('Prompt is required');
    }

    try {
      const { tabId: resolvedTabId } = await findOrCreateProviderTab(CHATGPT_HOST, CHATGPT_URL, tabId);
      await waitForTabComplete(resolvedTabId);

      const sendResults = await chrome.scripting.executeScript({
        target: { tabId: resolvedTabId },
        func: pageSendAndExtract,
        args: [prompt, timeoutMs],
      });
      const sent = sendResults && sendResults[0] ? (sendResults[0].result as any) : null;
      if (!sent || !sent.success) {
        return createErrorResponse(
          `ChatGPT send failed: ${sent?.error || 'unknown error'}`,
        );
      }

      let audioResult: { uploaded: boolean; path?: string; skipped?: boolean; error?: string } | null = null;
      if (withAudio) {
        const audioResults = await chrome.scripting.executeScript({
          target: { tabId: resolvedTabId },
          func: pageExtractAudio,
          args: [Math.min(timeoutMs, 60000)],
        });
        const captured = (audioResults && audioResults[0] ? audioResults[0].result : null) as ReplyAudio | null;
        const baseUrl = await resolveBackendBase(apiBaseUrl);
        audioResult = await uploadReplyAudio({
          baseUrl,
          provider: 'chatgpt-web',
          promptHash: shortHash(prompt),
          language,
          audio: captured || { ok: false, error: 'no audio result' },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              provider: 'chatgpt-web',
              success: true,
              answer: sent.answer,
              tabId: resolvedTabId,
              audio: audioResult,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in chrome_chatgpt:', error);
      return createErrorResponse(
        `ChatGPT automation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const chatgptSendPromptTool = new ChatGptSendPromptTool();
