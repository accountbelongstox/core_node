/**
 * Network Capture Tool - Unified network capture
 * Delegates to existing network capture tools
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { networkCaptureStartTool, networkCaptureStopTool } from './network-capture-web-request';
import { networkDebuggerStartTool, networkDebuggerStopTool } from './network-capture-debugger';

interface NetworkCaptureParams {
  action: 'start' | 'stop';
  needResponseBody?: boolean;
  url?: string;
  maxCaptureTime?: number;
  inactivityTimeout?: number;
  includeStatic?: boolean;
  tabId?: number;
}

class NetworkCaptureTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_CAPTURE;

  async execute(args: NetworkCaptureParams): Promise<ToolResult> {
    const { action, needResponseBody = false, tabId } = args || {};

    try {
      // Delegate to appropriate tool based on needResponseBody
      if (needResponseBody) {
        // Use debugger-based capture for response body
        if (action === 'start') {
          return await networkDebuggerStartTool.execute({
            tabId,
            maxCaptureTime: args.maxCaptureTime,
            inactivityTimeout: args.inactivityTimeout,
            includeStatic: args.includeStatic,
          });
        } else {
          return await networkDebuggerStopTool.execute({ tabId });
        }
      } else {
        // Use webRequest-based capture (lightweight)
        if (action === 'start') {
          return await networkCaptureStartTool.execute({
            tabId,
            maxCaptureTime: args.maxCaptureTime,
            inactivityTimeout: args.inactivityTimeout,
            includeStatic: args.includeStatic,
          });
        } else {
          return await networkCaptureStopTool.execute({ tabId });
        }
      }
    } catch (error) {
      console.error('Error in network capture tool:', error);
      return createErrorResponse(
        `Network capture error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const networkCaptureTool = new NetworkCaptureTool();
