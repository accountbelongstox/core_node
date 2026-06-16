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
