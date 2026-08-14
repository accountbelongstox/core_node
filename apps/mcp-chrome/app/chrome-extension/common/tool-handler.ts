import type { CallToolResult, TextContent, ImageContent } from '@modelcontextprotocol/sdk/types.js';

export { toErrorMessage } from '@/utils/errors';

export interface ToolResult extends CallToolResult {
  content: (TextContent | ImageContent)[];
  isError: boolean;
}

export interface ToolExecutor {
  execute(args: any): Promise<ToolResult>;
}

export interface JsonResponseOptions {
  isError?: boolean;
  space?: number;
}

export const createTextContent = (text: string): TextContent => ({ type: 'text', text });

export const createTextResponse = (text: string, isError = false): ToolResult => ({
  content: [createTextContent(text)],
  isError,
});

export const createJsonContent = (data: unknown, space?: number): TextContent => {
  return createTextContent(JSON.stringify(data, null, space) ?? 'null');
};

export const createJsonResponse = (
  data: unknown,
  options: JsonResponseOptions = {},
): ToolResult => {
  return {
    content: [createJsonContent(data, options.space)],
    isError: options.isError ?? false,
  };
};

export const createErrorResponse = (
  message: string = 'Unknown error, please try again',
): ToolResult => createTextResponse(message, true);
