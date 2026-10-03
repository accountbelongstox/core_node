/**
 * JavaScript Tool - Execute JavaScript in browser tab
 *
 * Execute JavaScript in the browser tab and return the result.
 * Uses Chrome DevTools Protocol Runtime.evaluate.
 */

import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { withTimeout } from '@/utils/async';
import { withDebuggerSession } from '@/utils/debugger-session';

interface JavaScriptToolParams {
  code: string;
  tabId?: number;
  windowId?: number;
  timeoutMs?: number;
  maxOutputBytes?: number;
  frameUrlContains?: string;
}

interface EvaluationResponse {
  exceptionDetails?: { exception?: { description?: string }; text?: string };
  result?: {
    description?: string;
    unserializableValue?: string;
    value?: unknown;
  };
}

// Cross-site iframes (e.g. Colab cell output frames) run as their own debugger
// targets; evaluating there bypasses both the origin boundary and page CSP.
async function frameTargets(urlPart: string): Promise<chrome.debugger.TargetInfo[]> {
  const targets = await chrome.debugger.getTargets();
  return targets.filter((target) => target.type === 'other' && target.url.includes(urlPart));
}

function evaluationValue(response: EvaluationResponse): unknown {
  if (response.exceptionDetails) {
    const details = response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || 'Unknown error';
    throw new Error(`JavaScript execution failed: ${details}`);
  }
  if (!response.result) {
    throw new Error('No result returned from script execution');
  }
  return Object.prototype.hasOwnProperty.call(response.result, 'value')
    ? response.result.value
    : response.result.unserializableValue ?? response.result.description ?? null;
}

class JavaScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.JAVASCRIPT;

  async execute(args: JavaScriptToolParams): Promise<ToolResult> {
    const { code, tabId, windowId, timeoutMs = 15000, maxOutputBytes = 51200, frameUrlContains } = args || {};

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return createErrorResponse('Parameter [code] is required');
    }

    try {
      // Use base class tab resolution for consistency with other tools
      let targetTab: chrome.tabs.Tab | null;
      if (typeof tabId === 'number') {
        targetTab = await this.tryGetTab(tabId);
      } else if (typeof windowId === 'number') {
        targetTab = await this.getActiveTabOrThrowInWindow(windowId);
      } else {
        targetTab = await this.resolveTargetTab();
      }

      if (!targetTab?.id) {
        return createErrorResponse('No active tab found');
      }

      const finalTabId = targetTab.id;

      const expression = `(async () => {\n${code}\n})()`;
      const evaluate = (debuggee: number | chrome.debugger.Debuggee) => withTimeout(
        withDebuggerSession(debuggee, async (target) => chrome.debugger.sendCommand(
          target,
          'Runtime.evaluate',
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
            userGesture: true,
          },
        )),
        timeoutMs,
        `Execution timed out after ${timeoutMs}ms`,
      ) as Promise<EvaluationResponse>;

      let value: unknown;
      if (frameUrlContains) {
        const frames = await frameTargets(frameUrlContains);
        if (frames.length === 0) {
          return createErrorResponse(`No frame target matches "${frameUrlContains}"`);
        }
        value = [];
        for (const frame of frames) {
          (value as unknown[]).push({
            url: frame.url,
            result: evaluationValue(await evaluate({ targetId: frame.id })),
          });
        }
      } else {
        value = evaluationValue(await evaluate(finalTabId));
      }
      let resultText: string;
      try {
        resultText = JSON.stringify(value, null, 2);
      } catch {
        resultText = String(value);
      }
      const outputLimit = Math.max(1, Math.floor(maxOutputBytes));
      const encoded = new TextEncoder().encode(resultText);
      const truncated = encoded.byteLength > outputLimit;
      if (truncated) resultText = `${new TextDecoder().decode(encoded.slice(0, outputLimit))}…`;

      return createJsonResponse({
        success: true,
        tabId: finalTabId,
        result: resultText,
        truncated,
      });
    } catch (error) {
      console.error('JavaScriptTool.execute error:', error);
      return createErrorResponse(
        `JavaScript tool error: ${toErrorMessage(error)}`,
      );
    }
  }
}

export const javascriptTool = new JavaScriptTool();
