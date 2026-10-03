/**
 * Content updates of held clips (WORDNEW_GUIDE R14's only automatic exception).
 *
 * A held clip is never deleted or fetched again - unless the server declares a new content version of it.
 * Laravel's read-only `audio/lookup` (with_version) reports, per clip, the version and the url of the file a
 * bundle would carry. A slice of the device's index is checked per run (a persisted position walks the whole
 * index over successive runs, so the load on the server stays small):
 *   - a clip stored without a version records the first version reported (no download),
 *   - a clip whose reported version differs from the recorded one is downloaded beside the old file and
 *     replaces it only when complete,
 *   - everything else is left alone.
 * Clips stored through a bundle carry the version of the bundle frame already.
 */
import { AUDIO_ORCH_CONTENT_UPDATE, AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { StorageManager } from '../../../../core/persistence';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { transferLimiter } from '../../../../core/network/TransferLimiter';
import { orchPool, orchRetry } from '../../../../shared/orchestration/orchClipResolver';
import { wfNewApi } from '../../api';
import { capApp } from '../../platform/capabilities';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewOrchClipStore, type OrchClipIndexEntry } from './WordNewOrchClipStore';

const FIRST_CHECK_DELAY_MS = 30_000;
const MINUTE_MS = 60_000;

interface ChangedClip {
  entry: OrchClipIndexEntry;
  url: string;
  version: number;
}

export interface OrchClipUpdateReport {
  checked: number;
  baselined: number;
  changed: number;
  replaced: number;
}

class WordNewClipUpdaterClass {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<OrchClipUpdateReport> | null = null;

  constructor() {
    if (!isNativeAppShell()) return;
    wordNewChannels.subscribe(() => {
      if (wordNewChannels.laravel()) this.schedule(FIRST_CHECK_DELAY_MS);
    });
    capApp.onResume(() => this.schedule(FIRST_CHECK_DELAY_MS));
    this.schedule(FIRST_CHECK_DELAY_MS);
  }

  private schedule(delayMs: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, delayMs);
  }

  /** One check run now (single-flight); `force` ignores the interval since the last run. */
  run(force = false): Promise<OrchClipUpdateReport> {
    this.running ??= this.check(force)
      .catch((): OrchClipUpdateReport => ({ checked: 0, baselined: 0, changed: 0, replaced: 0 }))
      .finally(() => { this.running = null; });
    return this.running;
  }

  private async check(force: boolean): Promise<OrchClipUpdateReport> {
    const report: OrchClipUpdateReport = { checked: 0, baselined: 0, changed: 0, replaced: 0 };
    if (!isNativeAppShell() || !wordNewChannels.laravel()) return report;
    const waitMs = AUDIO_ORCH_CONTENT_UPDATE.checkIntervalMs - (Date.now() - StorageManager.get<number>(StorageKeys.WORDNEW_CLIP_UPDATE_CHECKED_AT, 0));
    if (!force && waitMs > 0) {
      this.schedule(waitMs + MINUTE_MS);
      return report;
    }
    let cursor = StorageManager.get<number>(StorageKeys.WORDNEW_CLIP_UPDATE_CURSOR, 0);
    const changed: ChangedClip[] = [];
    for (let batch = 0; batch < AUDIO_ORCH_CONTENT_UPDATE.batchesPerRun; batch += 1) {
      const slice = await wordNewOrchClipStore.checkSlice(cursor, AUDIO_ORCH_TRANSFER.laravelBundleMaxItems);
      if (slice.entries.length === 0) {
        cursor = slice.next;
        break;
      }
      const results = await orchRetry(() => wfNewApi.lookupAudio(
        slice.entries.map(({ kind, language, text }) => ({ kind, language, text })),
        { withVersion: true },
      ));
      if (!results) return report;
      for (const [index, entry] of slice.entries.entries()) {
        const answer = results[index];
        report.checked += 1;
        if (!answer?.ready || !answer.url || !answer.version) continue;
        if (entry.version === undefined) {
          await wordNewOrchClipStore.noteVersion(entry.resourceId, answer.version);
          report.baselined += 1;
        } else if (answer.version !== entry.version) {
          changed.push({ entry, url: answer.url, version: answer.version });
        }
      }
      cursor = slice.next;
      StorageManager.set(StorageKeys.WORDNEW_CLIP_UPDATE_CURSOR, cursor);
      if (cursor === 0) break;
    }
    report.changed = changed.length;
    await orchPool(changed, async ({ entry, url, version }) => {
      const replaced = await orchRetry(() => transferLimiter.run('laravel', () => wordNewOrchClipStore.replaceFromUrl(entry, url, version)));
      if (replaced) report.replaced += 1;
    }, undefined, AUDIO_ORCH_CONTENT_UPDATE.downloadParallel);
    StorageManager.set(StorageKeys.WORDNEW_CLIP_UPDATE_CURSOR, cursor);
    StorageManager.set(StorageKeys.WORDNEW_CLIP_UPDATE_CHECKED_AT, Date.now());
    this.schedule(AUDIO_ORCH_CONTENT_UPDATE.checkIntervalMs + MINUTE_MS);
    return report;
  }
}

export const wordNewClipUpdater = new WordNewClipUpdaterClass();
