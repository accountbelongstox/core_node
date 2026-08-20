import { createErrorResponse, createJsonResponse, type ToolResult } from '@/common/tool-handler';
import { searchBookCoverUrls } from '@/entrypoints/background/services/web-search-service';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface BookCoverSearchParams {
  title: string;
  author?: string;
  engine?: 'google' | 'bing';
  waitForVerification?: boolean;
}

class BookCoverSearchTool {
  name = TOOL_NAMES.BROWSER.BOOK_COVER_SEARCH;

  async execute(args: BookCoverSearchParams): Promise<ToolResult> {
    const title = String(args.title || '').trim();
    const author = String(args.author || '').trim();
    if (!title) return createErrorResponse('title is required');

    const result = await searchBookCoverUrls(title, author, {
      preferEngine: args.engine === 'bing' ? 'bing' : 'google',
      waitForVerification: args.waitForVerification === true,
    });
    return createJsonResponse(result, { isError: !result.ok, space: 2 });
  }
}

export const bookCoverSearchTool = new BookCoverSearchTool();
