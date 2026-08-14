/**
 * Cold-service-worker retry helper.
 *
 * A `start` message sent to a background service worker that has been idle
 * (MV3 suspension) can be dropped because the worker hasn't finished
 * re-registering its listeners — `chrome.runtime.sendMessage` resolves to
 * `undefined`. One short-delay retry is the standard mitigation and costs
 * nothing on the (normal) warm-worker path.
 *
 * Usage:
 *   const resp = await sendWithWake(
 *     () => chrome.runtime.sendMessage({ type, action: 'start', ... }),
 *     'Gemini',
 *   );
 */
import { logger } from './logger';
import { delay as waitForDelay } from './async';

const LOG = 'sendWithWake';
const WAKE_DELAY_MS = 400;

/**
 * Send a message; if the response is `undefined` (cold worker dropped it),
 * retry once after a short delay.
 */
export async function sendWithWake<T = any>(
  sendFn: () => Promise<T>,
  providerLabel: string,
): Promise<T> {
  const first = await sendFn();
  if (first !== undefined) return first;
  logger.warn(
    LOG,
    `${providerLabel}: no response to 'start' (service worker likely cold) — retrying once`,
  );
  await waitForDelay(WAKE_DELAY_MS);
  return sendFn();
}
