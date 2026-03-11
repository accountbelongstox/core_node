/**
 * Computer Tool - Unified mouse/keyboard interaction tool
 * Simplified implementation that delegates to existing tools
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { clickTool, fillTool } from './interaction';
import { keyboardTool } from './keyboard';
import { screenshotTool } from './screenshot';

interface ComputerParams {
  action:
    | 'left_click'
    | 'right_click'
    | 'double_click'
    | 'triple_click'
    | 'left_click_drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'hover'
    | 'wait'
    | 'fill'
    | 'fill_form'
    | 'resize_page'
    | 'scroll_to'
    | 'zoom'
    | 'screenshot';
  coordinates?: { x: number; y: number };
  startCoordinates?: { x: number; y: number };
  ref?: string;
  startRef?: string;
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
  text?: string;
  repeat?: number;
  modifiers?: {
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  };
  selector?: string;
  value?: string | boolean | number;
  elements?: Array<{ ref: string; value: string }>;
  tabId?: number;
  windowId?: number;
  background?: boolean;
  duration?: number;
  timeout?: number;
  appear?: boolean;
}

class ComputerTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COMPUTER;

  async execute(args: ComputerParams): Promise<ToolResult> {
    const { action, tabId, windowId } = args || {};

    if (!action) {
      return createErrorResponse('Action parameter is required');
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else if (windowId) {
        targetTab = await this.getActiveTabOrThrowInWindow(windowId);
      } else {
        targetTab = await this.getActiveTabOrThrow();
      }

      if (!targetTab?.id) {
        return createErrorResponse('No active tab found');
      }

      // Delegate to existing tools based on action
      switch (action) {
        case 'left_click':
        case 'right_click': {
          // Resolve ref to coordinates if provided
          let coordinates = args.coordinates;
          if (args.ref && !coordinates) {
            try {
              await this.injectContentScript(targetTab.id, ['inject-scripts/accessibility-tree-helper.js']);
              const resolved = await this.sendMessageToTab(targetTab.id, {
                action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
                ref: args.ref,
              });
              if (resolved && resolved.success && resolved.center) {
                coordinates = { x: resolved.center.x, y: resolved.center.y };
              }
            } catch (e) {
              console.warn('Failed to resolve ref:', e);
            }
          }

          return await clickTool.execute({
            selector: args.selector,
            coordinates,
            waitForNavigation: false,
          });
        }

        case 'fill': {
          // Resolve ref to selector if provided
          let selector = args.selector;
          if (args.ref && !selector) {
            try {
              await this.injectContentScript(targetTab.id, ['inject-scripts/accessibility-tree-helper.js']);
              const resolved = await this.sendMessageToTab(targetTab.id, {
                action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
                ref: args.ref,
              });
              if (resolved && resolved.success && resolved.selector) {
                selector = resolved.selector;
              } else {
                return createErrorResponse(`Failed to resolve ref: ${args.ref}`);
              }
            } catch (e) {
              return createErrorResponse(`Failed to resolve ref: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          if (!selector) {
            return createErrorResponse('selector or ref is required for fill action');
          }
          return await fillTool.execute({
            selector,
            value: String(args.value ?? ''),
          });
        }

        case 'type':
        case 'key':
          return await keyboardTool.execute({
            keys: args.text || '',
            selector: args.selector,
          });

        case 'screenshot':
          return await screenshotTool.execute({
            name: 'computer_screenshot',
            selector: args.selector,
          });

        case 'wait':
          const waitDuration = args.duration ? Math.min(args.duration * 1000, 30000) : 1000;
          await new Promise((resolve) => setTimeout(resolve, waitDuration));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, action: 'wait', duration: waitDuration }),
              },
            ],
            isError: false,
          };

        default:
          return createErrorResponse(
            `Action "${action}" is not yet fully implemented. Please use specific tools (click, fill, keyboard, screenshot) instead.`,
          );
      }
    } catch (error) {
      console.error('Error in computer tool:', error);
      return createErrorResponse(
        `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const computerTool = new ComputerTool();
