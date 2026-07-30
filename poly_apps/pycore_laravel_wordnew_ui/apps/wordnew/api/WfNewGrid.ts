/**
 * WfNewGrid — the ONE responsive grid constant for the whole wordnew app.
 *
 * Lives in the api library (not a component) so EVERY page AND the data layer
 * share a single source of truth for "how many columns are on screen right now",
 * and therefore how many items make up a ROW. Pagination is expressed in ROWS
 * (home preview = 2 rows, list page = 20 rows); the per-page item count is
 * derived as columns × rows, so it is identical on desktop and mobile for a given
 * width — never hardcoded. (home preview = 2 rows, list page = 20 rows.)
 *
 * The column count is computed at STARTUP from the viewport width using the SAME
 * breakpoints the grid renders with (Tailwind sm/md/lg), so the constant always
 * matches the on-screen layout, and is corrected on every window resize.
 *
 * Usage:
 *   - React pages/components:  const cols = useWfNewGridCols();
 *   - non-React (API library):  wfNewGridCols(), wfNewPageSize(rows)
 */
import { useSyncExternalStore } from 'react';

/** Home preview cap and list-page size, in ROWS (× columns = items). */
export const WFNEW_HOME_ROWS = 2;
export const WFNEW_LIST_ROWS = 20;

/**
 * Columns per viewport width — MUST mirror the grid's Tailwind classes
 * `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`
 * (sm=640, md=768, lg=1024) so the constant equals the rendered column count.
 */
function computeCols(width: number): number {
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

let _cols = computeCols(typeof window !== 'undefined' ? window.innerWidth : 1280);
const _listeners = new Set<() => void>();

function _recompute() {
  const next = computeCols(window.innerWidth);
  if (next !== _cols) {
    _cols = next;
    _listeners.forEach((l) => l());
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', _recompute, { passive: true });
}

/** Current column count (non-React; for the API library's pagination math). */
export function wfNewGridCols(): number {
  return _cols;
}

/** Items per page for a given row count (columns × rows). */
export function wfNewPageSize(rows: number): number {
  return Math.max(1, _cols) * Math.max(1, rows);
}

/** Reactive column count — re-renders subscribers on resize across breakpoints. */
export function useWfNewGridCols(): number {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _cols,
    () => 5, // SSR/default snapshot
  );
}
