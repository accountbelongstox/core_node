import {
  getDuoreaderProgress,
  listDuoreaderBooks,
  pauseDuoreaderImport,
  resumeDuoreaderImport,
  startDuoreaderImport,
  stopDuoreaderImport,
  testDuoreaderImportApi,
  unpackPzMessageBytes,
} from './services/duoreader-importer-service';
import { logger } from '@/utils/logger';
import { registerRuntimeMessageHandler, toErrorMessage } from '@/utils/runtime-message';

const LOG = 'Duoreader Listener';

export function initDuoreaderImporterListener(): void {
  registerRuntimeMessageHandler('duoreader_importer', async (message: any) => {
    switch (message.action) {
      case 'start': {
        logger.info(LOG, 'Start requested from popup');
        void startDuoreaderImport({
          ...(message.config || {}),
          resume: message.resume === true,
        })
          .then((result) => {
            if (!result.success) {
              logger.warn(LOG, `Import failed to start: ${result.error}`);
            }
          })
          .catch((error) => {
            logger.error(LOG, 'Import crashed', error);
          });
        return { success: true, started: true };
      }
      case 'stop':
        await stopDuoreaderImport();
        logger.info(LOG, 'Stop acknowledged');
        return { success: true };
      case 'pause':
        await pauseDuoreaderImport();
        return { success: true };
      case 'resume': {
        const result = await resumeDuoreaderImport({
          ...(message.config || {}),
          resume: true,
        });
        return { success: result.success, error: result.error, resumed: result.resumed };
      }
      case 'get_status':
        return { success: true, progress: await getDuoreaderProgress() };
      case 'list_books': {
        const books = await listDuoreaderBooks(message.config || {}, {
          enrichCovers: message.enrichCovers === true,
        });
        logger.info(LOG, `list_books → ${books.length} item(s)`);
        return { success: true, books };
      }
      case 'test_api': {
        const result = await testDuoreaderImportApi(message.config || {}, message.bookId);
        return { success: result.ok, result, error: result.error };
      }
      case 'unpack_pz': {
        const bytes = message.bytes;
        if (!Array.isArray(bytes) && !(bytes instanceof Uint8Array)) {
          return { success: false, error: 'unpack_pz requires bytes array' };
        }
        const decoded = await unpackPzMessageBytes(bytes);
        return { success: true, decoded: Array.from(decoded), size: decoded.length };
      }
      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  }, {
    createErrorResponse: (error, message) => {
      logger.error(LOG, `Action ${message.action} failed`, error);
      return { success: false, error: toErrorMessage(error) };
    },
  });

  logger.info(LOG, 'Initialized');
}
