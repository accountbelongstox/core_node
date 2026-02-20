/**
 * GIF Recorder Tool - Record browser activity as animated GIF
 * Basic implementation
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface GifRecorderParams {
  action: 'start' | 'stop' | 'status' | 'auto_start' | 'capture' | 'clear' | 'export';
  tabId?: number;
  fps?: number;
  durationMs?: number;
  maxFrames?: number;
  width?: number;
  height?: number;
  download?: boolean;
}

interface RecordingState {
  recording: boolean;
  mode: 'fixed' | 'auto';
  tabId: number;
  frames: any[];
  startedAt: number;
  fps?: number;
}

const recordingStates = new Map<number, RecordingState>();

class GifRecorderTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GIF_RECORDER;

  async execute(args: GifRecorderParams): Promise<ToolResult> {
    const { action, tabId, fps = 5, durationMs = 5000, maxFrames = 50, width = 800, height = 600 } = args || {};

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        targetTab = await this.getActiveTabOrThrow();
      }

      if (!targetTab?.id) {
        return createErrorResponse('No active tab found');
      }

      const finalTabId = targetTab.id;
      const state = recordingStates.get(finalTabId);

      switch (action) {
        case 'start':
        case 'auto_start':
          if (state?.recording) {
            return createErrorResponse('Recording is already in progress');
          }
          recordingStates.set(finalTabId, {
            recording: true,
            mode: action === 'auto_start' ? 'auto' : 'fixed',
            tabId: finalTabId,
            frames: [],
            startedAt: Date.now(),
            fps: action === 'start' ? fps : undefined,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `GIF recording ${action === 'auto_start' ? 'auto-capture' : 'fixed-FPS'} mode started`,
                  mode: action === 'auto_start' ? 'auto' : 'fixed',
                }),
              },
            ],
            isError: false,
          };

        case 'stop':
          if (!state || !state.recording) {
            return createErrorResponse('No active recording found');
          }
          recordingStates.delete(finalTabId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'GIF recording stopped',
                  frameCount: state.frames.length,
                  durationMs: Date.now() - state.startedAt,
                }),
              },
            ],
            isError: false,
          };

        case 'status':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  recording: state?.recording || false,
                  mode: state?.mode || null,
                  frameCount: state?.frames.length || 0,
                  durationMs: state ? Date.now() - state.startedAt : 0,
                }),
              },
            ],
            isError: false,
          };

        case 'clear':
          recordingStates.delete(finalTabId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Recording state cleared' }),
              },
            ],
            isError: false,
          };

        default:
          return createErrorResponse(`Action "${action}" is not yet fully implemented`);
      }
    } catch (error) {
      console.error('Error in GIF recorder tool:', error);
      return createErrorResponse(
        `GIF recorder error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const gifRecorderTool = new GifRecorderTool();
