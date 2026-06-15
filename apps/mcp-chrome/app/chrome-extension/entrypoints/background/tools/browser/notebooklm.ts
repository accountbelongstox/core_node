import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

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
    const { question, notebookUrl, timeoutMs = 60000 } = args || {};

    try {
      const tab = await this.resolveTab(notebookUrl);
      if (!tab?.id) {
        return createErrorResponse('Failed to open or find a NotebookLM tab');
      }

      const result = await this.runInTab(tab.id, question, timeoutMs);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    } catch (error) {
      return createErrorResponse(
        `NotebookLM automation error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Ask/extract in an explicit, caller-owned tab (used by the test panel). */
  async runInTab(
    tabId: number,
    question: string | undefined,
    timeoutMs = 60000,
  ): Promise<NotebookLMResult> {
    await this.waitForTabComplete(tabId);
    await this.injectContentScript(tabId, ['inject-scripts/notebooklm-helper.js']);
    await new Promise((r) => setTimeout(r, 300));

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

  private waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // listener already gone
        }
        clearTimeout(timer);
        setTimeout(resolve, 600);
      };
      const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && info.status === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.get(tabId).then(
          (t) => {
            if (t.status === 'complete') finish();
          },
          () => finish(),
        );
      }, 700);
    });
  }
}

export const notebookLmTool = new NotebookLMTool();
