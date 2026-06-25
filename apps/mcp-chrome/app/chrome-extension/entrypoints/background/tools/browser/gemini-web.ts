/**
 * Gemini web automation tool (chrome_gemini).
 *
 * Page-driving style (like gemini-image.ts): reuses the live gemini.google.com
 * tab, injects gemini-web-helper.js, and drives it over the ping/submit/collect
 * protocol. Optionally captures the "Listen" audio bytes and uploads the binary
 * to the Laravel backend.
 */
import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';
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
const HELPER = 'inject-scripts/gemini-web-helper.js';
// Shared human-sim library, co-injected FIRST so the helper can use self.__WebOps
// (humanClick / waitFor / queryDeep / fetchBytes) for human-like send + audio.
const WEB_OPS = 'inject-scripts/web-ops.js';

class GeminiWebTool extends BaseBrowserToolExecutor {
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
      await this.injectContentScript(resolvedTabId, [WEB_OPS, HELPER]);

      const submitted = await this.sendMessageToTab(resolvedTabId, {
        action: 'geminiSubmitPrompt',
        prompt,
      });
      if (!submitted || !submitted.found) {
        return createErrorResponse(`Gemini submit failed: ${submitted?.error || 'input not found'}`);
      }

      const reply = await this.sendMessageToTab(resolvedTabId, {
        action: 'geminiCollectReply',
        timeoutMs,
        before: submitted.before || 0,
      });
      if (!reply || !reply.ready || !reply.answer) {
        return createErrorResponse(`Gemini reply failed: ${reply?.error || 'no answer'}`);
      }

      let audioResult: { uploaded: boolean; path?: string; skipped?: boolean; error?: string } | null = null;
      if (withAudio) {
        const captured = (await this.sendMessageToTab(resolvedTabId, {
          action: 'geminiCollectAudio',
          timeoutMs: Math.min(timeoutMs, 60000),
        })) as ReplyAudio;
        const baseUrl = await resolveBackendBase(apiBaseUrl);
        audioResult = await uploadReplyAudio({
          baseUrl,
          provider: 'gemini-web',
          promptHash: shortHash(prompt),
          language,
          audio: captured || { ok: false, error: 'no audio result' },
        });
        logger.info(
          'Gemini Web',
          `audio capture=${captured?.ok ? `ok (${captured.bytes?.length ?? 0}B ${captured.mime})` : `none (${captured?.error ?? 'n/a'})`} upload=${audioResult.uploaded}${audioResult.path ? ` path=${audioResult.path}` : ''}${audioResult.error ? ` err=${audioResult.error}` : ''}`,
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              provider: 'gemini-web',
              success: true,
              answer: reply.answer,
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

export const geminiWebTool = new GeminiWebTool();
