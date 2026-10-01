/**
 * The API center contract: every backend wordnew talks to (Laravel, pycore)
 * is one service with the same shape - an external store (`subscribe` /
 * `getSnapshot` for `useSyncExternalStore`), its endpoint entries, selection,
 * user entries and a diagnosis. The settings UI renders any service through it.
 * Detection only shows availability; the selection changes by the user alone,
 * and a selected endpoint that goes down is reconnected to.
 */

export type WordNewApiServiceId = 'laravel' | 'pycore';

export type WordNewApiServiceState = 'checking' | 'online' | 'reconnecting' | 'offline';

export type WordNewApiEntryState = 'unknown' | 'checking' | 'online' | 'offline' | 'refused' | 'relay';

export interface WordNewApiEntry {
  id: string;
  url: string;
  label: string;
  /** i18n key of the entry kind badge. */
  kindKey: string;
  state: WordNewApiEntryState;
  latencyMs: number | null;
  /** Raw error / detail text of the last probe ('' when none). */
  detail: string;
  selected: boolean;
  /** Used for this session only (e.g. a LAN scan result). */
  temporary: boolean;
  removable: boolean;
}

export interface WordNewApiServiceSnapshot {
  state: WordNewApiServiceState;
  selectedUrl: string;
  /** A session-only entry is in use (the next start drops it). */
  temporary: boolean;
  entries: WordNewApiEntry[];
  /** A probe pass is running. */
  busy: boolean;
}

export interface WordNewApiDiagnosis {
  ok: boolean;
  messageKey: string;
  params: Record<string, string | number>;
}

export interface WordNewApiService {
  id: WordNewApiServiceId;
  /** i18n keys: section title, description, add-entry placeholder, diagnosis hint. */
  titleKey: string;
  descriptionKey: string;
  addPlaceholderKey: string;
  diagnoseHintKey: string;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => WordNewApiServiceSnapshot;
  /** First detection (idempotent). */
  start(): void;
  /** Probe every entry (never switches; the first run selects); true when the selection answers. */
  refresh(): Promise<boolean>;
  /** Verified switch: only a reachable entry is selected. */
  select(entryId: string): Promise<boolean>;
  /** Add a user entry; false when the input is not usable here. */
  add(input: string): boolean;
  remove(entryId: string): void;
  /** Services with session-only entries: stop using the temporary entry. */
  clearTemporary?(): void;
  /** End-to-end check of the selected entry (a real API call). */
  diagnose(): Promise<WordNewApiDiagnosis>;
}
