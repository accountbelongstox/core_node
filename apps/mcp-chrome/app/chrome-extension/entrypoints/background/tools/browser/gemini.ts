/**
 * Gemini web automation tool (chrome_gemini).
 *
 * Drives the user's live gemini.google.com tab: types a prompt, submits, waits
 * for the model response to stabilize, extracts its text, optionally captures
 * the "Listen" TTS audio, and uploads that audio binary to the Laravel backend.
 * Reuses an existing Gemini tab when present (the currently-running browser).
 *
 * Gemini is built from Angular web components with deep shadow DOM, so the
 * page-context functions carry a self-contained shadow-piercing query helper.
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

const GEMINI_URL = 'https://gemini.google.com/app';
const GEMINI_HOST = 'gemini.google.com';

/** Page-context: send a prompt and return the stabilized model response text. */
const pageSendAndExtract = async (prompt: string, timeoutMs: number) => {
  // Self-contained shadow-DOM-piercing query (Gemini = Angular web components).
  const deepQueryAll = (selector: string): Element[] => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll(selector).forEach((el) => out.push(el));
      root.querySelectorAll('*').forEach((el) => {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
      });
    };
    walk(document);
    return out;
  };
  const deepFirst = (selectors: string[]): HTMLElement | null => {
    for (const s of selectors) {
      const found = deepQueryAll(s);
      if (found.length > 0) return found[found.length - 1] as HTMLElement;
    }
    return null;
  };

  const input = deepFirst([
    'rich-textarea .ql-editor[contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ]);
  if (!input) {
    return { success: false, error: 'Gemini input not found (are you logged in?)' };
  }

  const beforeCount = deepQueryAll('message-content, .model-response-text').length;

  input.focus();
  if (input.tagName === 'TEXTAREA') {
    (input as HTMLTextAreaElement).value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.textContent = prompt;
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
  }

  await new Promise((r) => setTimeout(r, 300));

  let sendBtn = deepFirst([
    'button[aria-label*="Send" i]:not([disabled])',
    'button.send-button:not([disabled])',
    'button[aria-label*="发送" i]:not([disabled])',
  ]);
  if (!sendBtn) {
    const icon = deepFirst(['mat-icon[fonticon="send"]']);
    if (icon) sendBtn = icon.closest('button') as HTMLElement | null;
  }
  if (sendBtn) {
    (sendBtn as HTMLButtonElement).click();
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
    await new Promise((r) => setTimeout(r, 900));
    const blocks = deepQueryAll('message-content, .model-response-text');
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
    return { success: false, error: 'Timed out waiting for Gemini reply', partial: last };
  }
  return { success: true, answer };
};

/** Page-context: trigger "Listen" and best-effort capture the audio bytes. */
const pageExtractAudio = async (timeoutMs: number) => {
  const deepQueryAll = (selector: string): Element[] => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll(selector).forEach((el) => out.push(el));
      root.querySelectorAll('*').forEach((el) => {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
      });
    };
    walk(document);
    return out;
  };

  let listenBtn: HTMLElement | null = null;
  const direct = deepQueryAll(
    'button[aria-label*="Listen" i], button[aria-label*="朗读" i], button[aria-label*="播放" i]',
  );
  if (direct.length > 0) {
    listenBtn = direct[direct.length - 1] as HTMLElement;
  } else {
    const icons = deepQueryAll('mat-icon[fonticon="volume_up"], mat-icon[fonticon="play_arrow"]');
    if (icons.length > 0) {
      listenBtn = (icons[icons.length - 1] as HTMLElement).closest('button') as HTMLElement | null;
    }
  }
  if (!listenBtn) {
    return { ok: false, error: 'Listen button not found' };
  }
  listenBtn.click();

  const start = Date.now();
  let src = '';
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
    const audios = deepQueryAll('audio') as HTMLAudioElement[];
    const a = audios.find((x) => typeof x.src === 'string' && x.src.length > 0);
    if (a) {
      src = a.src;
      break;
    }
  }
  if (!src) {
    return { ok: false, error: 'No audio source appeared' };
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

class GeminiSendPromptTool extends BaseBrowserToolExecutor {
  name = 'chrome_gemini';

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
      const { tabId: resolvedTabId } = await findOrCreateProviderTab(GEMINI_HOST, GEMINI_URL, tabId);
      await waitForTabComplete(resolvedTabId);

      const sendResults = await chrome.scripting.executeScript({
        target: { tabId: resolvedTabId },
        func: pageSendAndExtract,
        args: [prompt, timeoutMs],
      });
      const sent = sendResults && sendResults[0] ? (sendResults[0].result as any) : null;
      if (!sent || !sent.success) {
        return createErrorResponse(`Gemini send failed: ${sent?.error || 'unknown error'}`);
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
          provider: 'gemini-web',
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
              provider: 'gemini-web',
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
      console.error('Error in chrome_gemini:', error);
      return createErrorResponse(
        `Gemini automation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const geminiSendPromptTool = new GeminiSendPromptTool();
