/**
 * Master API base library barrel — the shared transport every end API lib
 * Application-owned API transports inherit this layer. See MasterApiClient.ts for the
 * contract (30-min default ceiling, persistent offline write queue, replay).
 */
export {
  MasterApiClient,
  QueuedError,
  isQueuedError,
  isNetworkLevelFailure,
  DEFAULT_CEILING_MS,
} from './MasterApiClient';
export type {
  MasterApiClientConfig,
  MasterRequestOptions,
  MasterQueueState,
  QueueEntryFailedInfo,
  MasterLogFn,
  MasterLogLevel,
} from './MasterApiClient';

export { RequestQueue, QUEUE_MAX_ENTRIES, QUEUE_MAX_AGE_MS } from './RequestQueue';
export type { QueuedRequestEntry } from './RequestQueue';

export { CURRENT_URL_TYPE, isCurrentUrlId } from './endpointIdentity';
