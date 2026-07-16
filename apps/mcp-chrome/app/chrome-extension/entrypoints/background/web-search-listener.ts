import {
  enrichBookCovers,
  getWebSearchProgress,
  runWebSearch,
  searchBookCoverUrls,
} from './services/web-search-service';
import { logger } from '@/utils/logger';

const LOG = 'Web Search Listener';

export function initWebSearchListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'web_search') return false;

    (async () => {
      try {
        switch (message.action) {
          case 'search': {
            const result = await runWebSearch(message.request || {});
            sendResponse({ success: result.ok || result.status === 'verification_required', result });
            break;
          }
          case 'book_cover': {
            const { title = '', author = '' } = message;
            const result = await searchBookCoverUrls(title, author, message.options || {});
            sendResponse({ success: result.ok, result });
            break;
          }
          case 'enrich_book_covers': {
            const books = await enrichBookCovers(message.books || [], message.options || {});
            sendResponse({ success: true, books });
            break;
          }
          case 'get_status':
            sendResponse({ success: true, progress: await getWebSearchProgress() });
            break;
          default:
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error(LOG, error, err);
        sendResponse({ success: false, error });
      }
    })();

    return true;
  });

  logger.info(LOG, 'Initialized');
}
