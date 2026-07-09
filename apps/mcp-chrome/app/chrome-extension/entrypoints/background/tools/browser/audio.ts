import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import {
  handleAudioStart,
  handleAudioStop,
  handleAudioStatus,
  handleAudioDuration,
  FIREFOX_AUDIO_UNSUPPORTED_ERROR,
} from '../audio';

/**
 * Tool for starting audio recording
 */
class AudioStartTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.AUDIO_START;

  async execute(args: any): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_AUDIO_UNSUPPORTED_ERROR);
    }

    try {
      const result = await handleAudioStart(args);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to start audio recording');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      console.error('AudioStartTool: Error during execute:', error);
      return createErrorResponse(`Error in AudioStartTool: ${error.message || String(error)}`);
    }
  }
}

/**
 * Tool for stopping audio recording
 */
class AudioStopTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.AUDIO_STOP;

  async execute(args: any): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_AUDIO_UNSUPPORTED_ERROR);
    }

    try {
      const result = await handleAudioStop(args);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to stop audio recording');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      console.error('AudioStopTool: Error during execute:', error);
      return createErrorResponse(`Error in AudioStopTool: ${error.message || String(error)}`);
    }
  }
}

/**
 * Tool for getting audio recording status
 */
class AudioStatusTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.AUDIO_STATUS;

  async execute(_args: any): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_AUDIO_UNSUPPORTED_ERROR);
    }

    try {
      const result = await handleAudioStatus();

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to get audio status');
      }

      return {
        content: [
          {
            type: 'text',
            // handleAudioStatus returns the payload under .status, not .data
            text: JSON.stringify(result.status),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      console.error('AudioStatusTool: Error during execute:', error);
      return createErrorResponse(`Error in AudioStatusTool: ${error.message || String(error)}`);
    }
  }
}

/**
 * Tool for getting audio recording duration
 */
class AudioDurationTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.AUDIO_DURATION;

  async execute(_args: any): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_AUDIO_UNSUPPORTED_ERROR);
    }

    try {
      const result = await handleAudioDuration();

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to get audio duration');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      console.error('AudioDurationTool: Error during execute:', error);
      return createErrorResponse(`Error in AudioDurationTool: ${error.message || String(error)}`);
    }
  }
}

export const audioStartTool = new AudioStartTool();
export const audioStopTool = new AudioStopTool();
export const audioStatusTool = new AudioStatusTool();
export const audioDurationTool = new AudioDurationTool();
