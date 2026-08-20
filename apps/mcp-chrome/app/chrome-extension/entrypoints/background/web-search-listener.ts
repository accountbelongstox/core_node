import {
  enrichBookCovers,
  getWebSearchProgress,
  runWebSearch,
  searchBookCoverUrls,
} from './services/web-search-service';
import { logger } from '@/utils/logger';
import { registerRuntimeMessageHandler } from '@/utils/runtime-message';
import { toErrorMessage } from '@/utils/errors';

const LOG = 'Web Search Listener';

export function initWebSearchListener(): void {
  registerRuntimeMessageHandler('web_search', async (message: any) => {
    switch (message.action) {
      case 'search': {
        const result = await runWebSearch(message.request || {});
        return { success: result.ok || result.status === 'verification_required', result };
      }
      case 'book_cover': {
        const { title = '', author = '' } = message;
        const result = await searchBookCoverUrls(title, author, message.options || {});
        return { success: result.ok, result };
      }
      case 'enrich_book_covers': {
        const books = await enrichBookCovers(message.books || [], message.options || {});
        return { success: true, books };
      }
      case 'get_status':
        return { success: true, progress: await getWebSearchProgress() };
      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  }, {
    createErrorResponse: (error) => {
      const message = toErrorMessage(error);
      logger.error(LOG, message, error);
      return { success: false, error: message };
    },
  });

  logger.info(LOG, 'Initialized');
}
