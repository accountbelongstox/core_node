// This must stay first so Firefox aliases browser APIs before other modules load.
import '@/utils/browser-shim';
import { initializeBackground } from './bootstrap';
import { logger } from '@/utils/logger';

const BENIGN_REJECTION_PATTERNS = [
  'Could not establish connection',
  'Receiving end does not exist',
  'Duplicate script ID',
] as const;

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
  if (BENIGN_REJECTION_PATTERNS.some((pattern) => message.includes(pattern))) {
    event.preventDefault();
    return;
  }
  logger.error('Background', 'Unhandled promise rejection', event.reason);
}

export default defineBackground(() => {
  self.addEventListener('unhandledrejection', handleUnhandledRejection);
  initializeBackground();
});
