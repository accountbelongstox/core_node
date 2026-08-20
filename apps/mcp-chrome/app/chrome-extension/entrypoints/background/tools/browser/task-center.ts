import { createErrorResponse, createJsonResponse, type ToolResult } from '@/common/tool-handler';
import { DEFAULT_API_BASE_URL } from '@/config/api-endpoints';
import {
  executeTaskCenterCommand,
  executeValidityRunnerCommand,
} from '@/entrypoints/background/task-center-listener';
import type { CapabilityKey } from '@/utils/task-capabilities';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface TaskCenterToolParams {
  action: 'status' | 'start' | 'stop' | 'set_capability' | 'test_validity';
  apiBaseUrl?: string;
  capabilities?: CapabilityKey[];
  capability?: CapabilityKey;
  enabled?: boolean;
  words?: string[];
  provider?: 'deepseek' | 'gemini' | 'chatgpt';
}

class TaskCenterTool {
  name = TOOL_NAMES.BROWSER.TASK_CENTER;

  async execute(args: TaskCenterToolParams): Promise<ToolResult> {
    const apiUrl = String(args.apiBaseUrl || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
    let response: any;

    switch (args.action) {
      case 'status':
        response = await executeTaskCenterCommand({ action: 'get_status' });
        break;
      case 'start':
        response = await executeTaskCenterCommand({
          action: 'start',
          config: {
            apiUrl,
            activeCapabilities: Array.isArray(args.capabilities) ? args.capabilities : [],
          },
        });
        break;
      case 'stop':
        response = await executeTaskCenterCommand({ action: 'stop' });
        break;
      case 'set_capability':
        if (!args.capability || typeof args.enabled !== 'boolean') {
          return createErrorResponse('capability and enabled are required');
        }
        response = await executeTaskCenterCommand({
          action: 'set_capability',
          capability: args.capability,
          enabled: args.enabled,
          config: { apiUrl },
        });
        break;
      case 'test_validity':
        response = await executeValidityRunnerCommand({
          action: 'test',
          words: args.words,
          provider: args.provider,
        });
        break;
      default:
        return createErrorResponse(`Unknown action: ${String(args.action)}`);
    }

    return createJsonResponse(response, { isError: response?.success === false, space: 2 });
  }
}

export const taskCenterTool = new TaskCenterTool();
