import {
  getDuoreaderProgress,
  listDuoreaderBooks,
  startDuoreaderImport,
  stopDuoreaderImport,
  testDuoreaderImportApi,
} from './services/duoreader-importer-service';
import { logger } from '@/utils/logger';

const LOG = 'Duoreader Listener';

export function initDuoreaderImporterListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'duoreader_importer') return false;

    (async () => {
      try {
        switch (message.action) {
          case 'start': {
            logger.info(LOG, 'Start requested from popup');
            void startDuoreaderImport(message.config || {})
              .then((result) => {
                if (!result.success) {
                  logger.warn(LOG, `Import failed to start: ${result.error}`);
                }
              })
              .catch((err) => {
                logger.error(LOG, 'Import crashed', err);
              });
            sendResponse({ success: true, started: true });
            break;
          }
          case 'stop':
            await stopDuoreaderImport();
            logger.info(LOG, 'Stop acknowledged');
            sendResponse({ success: true });
            break;
          case 'get_status':
            sendResponse({ success: true, progress: await getDuoreaderProgress() });
            break;
          case 'list_books': {
            const books = await listDuoreaderBooks(message.config || {});
            logger.info(LOG, `list_books → ${books.length} item(s)`);
            sendResponse({ success: true, books });
            break;
          }
          case 'test_api': {
            const result = await testDuoreaderImportApi(message.config || {}, message.bookId);
            sendResponse({ success: result.ok, result, error: result.error });
            break;
          }
          default:
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (error: any) {
        logger.error(LOG, `Action ${message.action} failed`, error);
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();

    return true;
  });

  logger.info(LOG, 'Initialized');
}
