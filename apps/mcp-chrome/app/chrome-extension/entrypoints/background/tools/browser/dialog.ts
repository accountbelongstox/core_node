import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { handleDialogFirefox } from './dialog-firefox';

interface HandleDialogParams {
  action: 'accept' | 'dismiss';
  promptText?: string;
  tabId?: number;
}

/**
 * Handle JavaScript dialogs (alert/confirm/prompt) via CDP Page.handleJavaScriptDialog
 */
class HandleDialogTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.HANDLE_DIALOG;

  async execute(args: HandleDialogParams): Promise<ToolResult> {
    const { action, promptText, tabId } = args || ({} as HandleDialogParams);
    if (!action || (action !== 'accept' && action !== 'dismiss')) {
      return createErrorResponse('action must be "accept" or "dismiss"');
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = activeTab;
      }

      if (!targetTab?.id) return createErrorResponse('No active tab found');
      const finalTabId = targetTab.id;

      if (import.meta.env.FIREFOX) {
        // Firefox has no chrome.debugger/CDP: arm a MAIN-world auto-responder
        // for future dialogs instead of answering a currently open one.
        return await handleDialogFirefox(finalTabId, action, promptText);
      }

      // Attach debugger
      try {
        await chrome.debugger.attach({ tabId: finalTabId }, '1.3');
      } catch (error: any) {
        // If already attached, continue
        if (!error?.message?.includes('Another debugger')) {
          throw error;
        }
      }

      try {
        await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Page.enable');
        await chrome.debugger.sendCommand(
          { tabId: finalTabId },
          'Page.handleJavaScriptDialog',
          {
            accept: action === 'accept',
            promptText: action === 'accept' ? promptText : undefined,
          },
        );
      } finally {
        // Detach debugger
        try {
          await chrome.debugger.detach({ tabId: finalTabId });
        } catch {
          // Ignore detach errors
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, action, promptText: promptText || null }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Failed to handle dialog: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const handleDialogTool = new HandleDialogTool();
