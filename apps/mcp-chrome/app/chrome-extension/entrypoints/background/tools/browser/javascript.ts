/**
 * JavaScript Tool - Execute JavaScript in browser tab
 *
 * Execute JavaScript in the browser tab and return the result.
 * Uses chrome.scripting.executeScript with ISOLATED world.
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface JavaScriptToolParams {
  code: string;
  tabId?: number;
  timeoutMs?: number;
}

class JavaScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.JAVASCRIPT;

  async execute(args: JavaScriptToolParams): Promise<ToolResult> {
    const { code, tabId, timeoutMs = 15000 } = args || {};

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return createErrorResponse('Parameter [code] is required');
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = activeTab;
      }

      if (!targetTab?.id) {
        return createErrorResponse('No active tab found');
      }

      const finalTabId = targetTab.id;

      // Execute script with timeout
      const executePromise = chrome.scripting.executeScript({
        target: { tabId: finalTabId },
        world: 'ISOLATED',
        func: (userCode: string) => {
          try {
            // Use AsyncFunction constructor to support top-level await
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const fn = new AsyncFunction(userCode);
            return fn().then(
              (value: any) => ({ success: true, result: value }),
              (error: any) => ({
                success: false,
                error: {
                  name: error?.name || 'Error',
                  message: error?.message || String(error),
                },
              }),
            );
          } catch (err: any) {
            return {
              success: false,
              error: {
                name: err?.name || 'Error',
                message: err?.message || String(err),
              },
            };
          }
        },
        args: [code],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs),
      );

      const results = await Promise.race([executePromise, timeoutPromise]);
      const firstFrame = results?.[0];
      const result = (firstFrame as { result?: any })?.result;

      if (!result || typeof result !== 'object') {
        return createErrorResponse('No result returned from script execution');
      }

      if (!result.success) {
        return createErrorResponse(
          `JavaScript execution failed: ${result.error?.message || 'Unknown error'}`,
        );
      }

      // Serialize result
      let resultText: string;
      try {
        resultText = JSON.stringify(result.result, null, 2);
      } catch {
        resultText = String(result.result);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              tabId: finalTabId,
              result: resultText,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('JavaScriptTool.execute error:', error);
      return createErrorResponse(
        `JavaScript tool error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const javascriptTool = new JavaScriptTool();
