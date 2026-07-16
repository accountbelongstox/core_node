/**
 * wfNewApi — the /wordnew data gateway. ONE import for every page/component.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SWITCH MOCK ⇄ REAL HERE — by which line is active below.                 │
 * │                                                                           │
 * │  • REAL backend (default): keep the WfNewApiHttp line uncommented.        │
 * │  • OFFLINE / AI Studio / sandbox with no backend: comment the Http line   │
 * │    and uncomment the WfNewApiMock line. Nothing else changes — both       │
 * │    implement the SAME `WfNewApi` interface from ./WfNewApiTypes.          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Consumers do `import { wfNewApi } from '../api'` and never touch the impls
 * directly, so this single line is the only thing that decides mock vs real.
 * See ./README.md for the full contract + the "change API → sync mock" rule.
 */
import type { WfNewApi } from './WfNewApiTypes';

import { wfNewApiHttp } from './WfNewApiHttp';
// import { wfNewApiMock } from './WfNewApiMock';   // ← swap to this for offline/mock

export const wfNewApi: WfNewApi = wfNewApiHttp;
// export const wfNewApi: WfNewApi = wfNewApiMock;  // ← swap to this for offline/mock

// Re-export the whole shared type surface so consumers import everything from
// one place: `import { wfNewApi, type Word, type BentoGroup } from '../api'`.
export * from './WfNewApiTypes';

// Endpoint list center — the single source of truth for every backend path the
// app calls (verified against laravel_main routes/AppQyV1Router/*). The http
// impl routes through it; import it anywhere a raw path would otherwise be typed.
export {
  WfNewApiPaths, WfNewAdminPaths, WFNEW_API_BASE, WFNEW_HEALTH_PATH,
  WFNEW_ADMIN_DEBUG_STATUS_PATH,
} from './WfNewApiPaths';

// Super-admin gateway (loopback local-management mode) — separate from the
// http/mock pair on purpose: pinned page-origin base, only alive when the
// backend grants the loopback debug bypass. See WfNewAdminApi header.
export { wfNewAdminApi } from './WfNewAdminApi';
export type {
  WfNewSuperAdminStatus, WfNewAdminWordRow, WfNewAdminWordsPage,
  WfNewAdminWordFilter, WfNewAdminWordSort, WfNewAdminWordEditable,
  WfNewAdminBatchAction, WfNewAdminLangRow, WfNewAdminSentence,
  WfNewAdminLibraryRow, WfNewAdminLibrariesPage, WfNewAdminStatistics,
  WfNewAdminTtsQueueStats, WfNewAdminQueueItem, WfNewAdminQueueItemsPage,
  WfNewAdminTransTask, WfNewAdminTranslateResult, WfNewAdminLangOption,
} from './WfNewAdminApi';

// Backend endpoint management (default list, health probe, STORED-FIRST
// auto-select + offline retry). Used by the Settings → API Server panel and the
// http impl. Mock mode ignores it (no network).
export {
  wfNewEndpoints, WFNEW_API_HEALTH_EVENT, WFNEW_API_PORT,
  buildEndpointUrl, CURRENT_URL_TYPE, isCurrentUrlId,
} from './WfNewEndpoints';
export { useWfNewEndpoints } from './useWfNewEndpoints';

// Social realtime — the SSE push client (separate from the request/response impl).
// Start/stop app-level on login/logout; pages subscribe to events via subscribeSocial.
export {
  startSocialSse, stopSocialSse, subscribeSocial, isSocialSseConnected,
} from './WfNewSocialSse';
export type { WfNewSocialEvent } from './WfNewSocialSse';

// Persisted endpoint settings store (subclass of the shared PersistedStore).
export { wfNewEndpointStore } from './WfNewEndpointStore';
export type { WfNewEndpointPrefs } from './WfNewEndpointStore';

// ONE responsive grid constant for the whole app (columns-per-width), shared by
// every page AND used here for ROW-based pagination (page size = columns × rows).
// Computed at startup, corrected on resize. Never hardcoded per page.
export {
  useWfNewGridCols, wfNewGridCols, wfNewPageSize, WFNEW_HOME_ROWS, WFNEW_LIST_ROWS,
} from './WfNewGrid';
