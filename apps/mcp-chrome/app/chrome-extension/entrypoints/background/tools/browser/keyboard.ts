import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { TIMEOUTS, ERROR_MESSAGES } from '@/common/constants';

interface KeyboardToolParams {
  keys: string; // Required: string representing keys or key combinations to simulate (e.g., "Enter", "Ctrl+C")
  selector?: string; // Optional: CSS selector for target element to send keyboard events to
  delay?: number; // Optional: delay between keystrokes in milliseconds
  repeat?: number; // Optional: number of times to repeat the key sequence (1-100, default 1)
  tabId?: number; // Optional: target a specific tab instead of the active tab of the current window
}

/**
 * Tool for simulating keyboard input on web pages
 */
class KeyboardTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.KEYBOARD;

  /**
   * Execute keyboard operation
   */
  async execute(args: KeyboardToolParams): Promise<ToolResult> {
    const { keys, selector, delay = TIMEOUTS.KEYBOARD_DELAY, repeat, tabId } = args;

    console.log(`Starting keyboard operation with options:`, args);

    if (!keys) {
      return createErrorResponse(
        ERROR_MESSAGES.INVALID_PARAMETERS + ': Keys parameter must be provided',
      );
    }

    // Clamp repeat to a safe range (1-100) to prevent runaway loops
    const safeRepeat = typeof repeat === 'number' ? Math.max(1, Math.min(Math.floor(repeat), 100)) : 1;

    try {
      // Resolve target tab (explicit tabId wins; otherwise the active tab)
      const tab = await this.resolveTargetTab(tabId);
      if (!tab?.id) {
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
      }

      await this.injectContentScript(tab.id, ['inject-scripts/keyboard-helper.js']);

      // Send keyboard simulation message to content script.
      // The content script does not support repeat natively, so we loop here.
      let lastResult: any = null;
      for (let i = 0; i < safeRepeat; i++) {
        lastResult = await this.sendMessageToTab(tab.id, {
          action: TOOL_MESSAGE_TYPES.SIMULATE_KEYBOARD,
          keys,
          selector,
          delay,
        });

        if (lastResult?.error) {
          return createErrorResponse(lastResult.error);
        }

        // The keyboard helper returns { success: false, message, results } (no `error`
        // field) when one or more key combos in the sequence failed to parse/dispatch.
        // Surface that as a failure instead of reporting success:true.
        if (lastResult?.success === false) {
          return createErrorResponse(lastResult.message || 'Keyboard operation failed');
        }

        // Brief pause between repeats to avoid overwhelming the page
        if (i < safeRepeat - 1 && delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: lastResult?.message || 'Keyboard operation successful',
              targetElement: lastResult?.targetElement,
              results: lastResult?.results,
              repeat: safeRepeat,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in keyboard operation:', error);
      return createErrorResponse(
        `Error simulating keyboard events: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const keyboardTool = new KeyboardTool();
