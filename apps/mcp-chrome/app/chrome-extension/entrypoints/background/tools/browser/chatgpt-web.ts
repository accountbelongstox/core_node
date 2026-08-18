/**
 * ChatGPT web automation tool (chrome_chatgpt).
 *
 * Page-driving style (like notebooklm.ts / gemini-image.ts), NOT inline
 * executeScript: it reuses the user's live chatgpt.com tab, injects
 * chatgpt-web-helper.js, and drives it over the ping/submit/collect message
 * protocol. Optionally captures the read-aloud audio (bytes returned from the
 * page) and uploads the binary to the Laravel backend.
 */
import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { logger } from '@/utils/logger';
import { WebChatJobToolBase, type WebChatJobConfig } from './web-chat-job-base';
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
const HELPER = 'inject-scripts/chatgpt-web-helper.js';
// Shared human-sim library, co-injected FIRST so the helper can use self.__WebOps
// (humanClick / waitFor / fetchBytes) for human-like send + audio capture.
const WEB_OPS = 'inject-scripts/web-ops.js';

class ChatGptWebTool extends WebChatJobToolBase {
  name = 'chrome_chatgpt';

  protected jobConfig: WebChatJobConfig = {
    providerLabel: 'ChatGPT Web',
    providerHost: CHATGPT_HOST,
    providerUrl: CHATGPT_URL,
    helperFiles: [WEB_OPS, HELPER],
    submitAction: 'chatgptSubmitPrompt',
    peekAction: 'chatgptPeekReply',
    jobsStorageKey: 'chatgpt_text_jobs',
  };

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
      await this.injectContentScript(resolvedTabId, [WEB_OPS, HELPER]);

      const submitted = await this.sendMessageToTab(resolvedTabId, {
        action: 'chatgptSubmitPrompt',
        prompt,
      });
      if (!submitted || !submitted.found) {
        return createErrorResponse(`ChatGPT submit failed: ${submitted?.error || 'input not found'}`);
      }

      const reply = await this.sendMessageToTab(resolvedTabId, {
        action: 'chatgptCollectReply',
        timeoutMs,
        before: submitted.before || 0,
      });
      if (!reply || !reply.ready || !reply.answer) {
        return createErrorResponse(`ChatGPT reply failed: ${reply?.error || 'no answer'}`);
      }

      let audioResult: { uploaded: boolean; path?: string; skipped?: boolean; error?: string } | null = null;
      if (withAudio) {
        const captured = (await this.sendMessageToTab(resolvedTabId, {
          action: 'chatgptCollectAudio',
          timeoutMs: Math.min(timeoutMs, 60000),
        })) as ReplyAudio;
        const baseUrl = await resolveBackendBase(apiBaseUrl);
        audioResult = await uploadReplyAudio({
          baseUrl,
          provider: 'chatgpt-web',
          promptHash: shortHash(prompt),
          language,
          audio: captured || { ok: false, error: 'no audio result' },
        });
        logger.info(
          'ChatGPT Web',
          `audio capture=${captured?.ok ? `ok (${captured.bytes?.length ?? 0}B ${captured.mime})` : `none (${captured?.error ?? 'n/a'})`} upload=${audioResult.uploaded}${audioResult.path ? ` path=${audioResult.path}` : ''}${audioResult.error ? ` err=${audioResult.error}` : ''}`,
        );
      }

      return createJsonResponse({
        provider: 'chatgpt-web',
        success: true,
        answer: reply.answer,
        tabId: resolvedTabId,
        audio: audioResult,
      });
    } catch (error) {
      console.error('Error in chrome_chatgpt:', error);
      return createErrorResponse(
        `ChatGPT automation failed: ${toErrorMessage(error)}`,
      );
    }
  }
}

export const chatgptWebTool = new ChatGptWebTool();
