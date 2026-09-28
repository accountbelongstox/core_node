import { createErrorResponse, toErrorMessage } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import { FIREFOX_UNSUPPORTED_TOOLS, FIREFOX_UNSUPPORTED_TOOL_REASONS } from 'chrome-mcp-shared';
import * as browserTools from './browser';

const tools = { ...browserTools };
const toolsMap = new Map(Object.values(tools).map((tool) => [tool.name, tool]));

/**
 * Tool call parameter interface
 */
export interface ToolCallParam {
  name: string;
  args: any;
}

/**
 * Handle tool execution
 */
export const handleCallTool = async (param: ToolCallParam) => {
  if (import.meta.env.FIREFOX && FIREFOX_UNSUPPORTED_TOOLS.has(param.name)) {
    return createErrorResponse(
      `Tool ${param.name} is not supported on Firefox. ${FIREFOX_UNSUPPORTED_TOOL_REASONS[param.name]}.`,
    );
  }

  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  try {
    return await tool.execute(param.args);
  } catch (error) {
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      toErrorMessage(error) || ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  }
};
