import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { waitForTabComplete } from '@/utils/tab-readiness';
import { delay as waitForDelay } from '@/utils/async';

const NOTEBOOKLM_URL = 'https://notebooklm.google.com';

export interface NotebookLMResult {
  success: boolean;
  question?: string;
  answer: string;
  error: string | null;
  url?: string;
  tabId?: number;
}

interface NotebookLMParams {
  prompt?: string;
  question?: string;
  notebookUrl?: string;
  timeoutMs?: number;
}

/**
 * Drive Google NotebookLM in the browser: ask a question in a notebook's chat
 * and return the source-grounded answer (or just extract the latest answer).
 * Reuses an open NotebookLM tab, or opens one. The DOM scraping lives in the
 * injected helper (resilient, semantic selectors).
 */
class NotebookLMTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NOTEBOOKLM;

  async execute(args: NotebookLMParams): Promise<ToolResult> {
    const { notebookUrl, timeoutMs = 60000 } = args || {};
    const question = args?.question || args?.prompt;

    try {
      const tab = await this.resolveTab(notebookUrl);
      if (!tab?.id) {
        return createErrorResponse('Failed to open or find a NotebookLM tab');
      }

      const result = await this.runInTab(tab.id, question, timeoutMs);
      return createJsonResponse(result, { isError: !result.success, space: 2 });
    } catch (error) {
      return createErrorResponse(
        `NotebookLM automation error: ${toErrorMessage(error)}`,
      );
    }
  }

  /** Ask/extract in an explicit, caller-owned tab (used by the test panel). */
  async runInTab(
    tabId: number,
    question: string | undefined,
    timeoutMs = 60000,
  ): Promise<NotebookLMResult> {
    await waitForTabComplete(tabId, {
      timeoutMs: 20000,
      settleDelayMs: 600,
      statusProbeDelayMs: 700,
    });
    await this.injectContentScript(tabId, ['inject-scripts/notebooklm-helper.js']);
    await waitForDelay(300);

    const action = question && question.trim() ? 'notebooklmAsk' : 'notebooklmExtract';
    const response: NotebookLMResult = await this.sendMessageToTab(tabId, {
      action,
      question: question || '',
      timeoutMs,
    });

    if (response) {
      response.tabId = tabId;
    }
    return response || { success: false, answer: '', error: 'No response from NotebookLM helper' };
  }

  /** Reuse an open NotebookLM tab, optionally navigating it to notebookUrl. */
  private async resolveTab(notebookUrl?: string): Promise<chrome.tabs.Tab | undefined> {
    const all = await chrome.tabs.query({});
    let tab = all.find((t) => t.url && t.url.includes('notebooklm.google.com'));

    const target = notebookUrl && notebookUrl.trim() ? notebookUrl.trim() : undefined;

    if (tab?.id) {
      if (target && tab.url !== target) {
        await chrome.tabs.update(tab.id, { url: target, active: true });
      } else {
        await chrome.tabs.update(tab.id, { active: true });
      }
      return tab;
    }

    tab = await chrome.tabs.create({ url: target || NOTEBOOKLM_URL, active: true });
    return tab;
  }

}

export const notebookLmTool = new NotebookLMTool();
