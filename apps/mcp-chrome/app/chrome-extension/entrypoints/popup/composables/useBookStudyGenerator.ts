/**
 * Book Study Generator composable (popup).
 *
 * Drives the segment-based study-content generation pipeline defined in
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md — Laravel OWNS
 * that contract; do NOT rename any endpoint path or payload key here.
 *
 * Flow per source (doc §7): list sources with progress → claim one ~500-char
 * segment → build the segment prompt (promptPresets.buildBookStudySegmentPrompt)
 * → drive the selected web-AI provider via its existing `<provider>_text_service`
 * background bridge (reused from useArticleStudyGuide — NO new background
 * listener) with a cold-service-worker start retry → poll the job every 3s until
 * a stable reply → parse (studyReplyParser) → POST submit → refresh progress →
 * if "Auto-run" is on and pending segments remain, claim the next. A
 * parse/generation failure releases the segment with the error and stops.
 *
 * Popup-death resilience: the in-flight unit persists as ONE atomic
 * usePersistedRef('bookStudyActiveJob') value {jobId, provider, sourceType,
 * sourceKey, segmentIndex, autoRun}; a watch resumes it on mount (a single
 * atomic value can't restore its fields out of order). The provider job itself
 * survives service-worker restarts in the background; the 60-min server lease
 * covers the popup being closed mid-generation, and submit after lease expiry
 * still lands (the idempotency gate is `done`, not the lease).
 */
import { ref, computed, watch } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { apiManager } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { logger } from '@/utils/logger';
import { sendWithWake } from '@/utils/sendWithWake';
import {
  PROVIDER_MESSAGE_TYPE,
  PROVIDER_LABELS,
  type ArticleStudyGuideProvider,
} from './useArticleStudyGuide';
import { buildBookStudySegmentPrompt, type BookStudySlot } from './promptPresets';
import { parseStudySegmentReply } from './studyReplyParser';
import { studyGenPath } from '@/utils/api-paths';

const LOG = 'Book Study Generator';

export type StudyProvider = ArticleStudyGuideProvider;
export type StudySourceType = 'book' | 'article' | 'document';

// Poll cadence + ceiling for the provider job status loop (mirrors
// useArticleStudyGuide.ts / useGeminiImage.ts).
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 200; // ~10 min per (re)poll session — study replies are long
const START_TIMEOUT_MS = 300000;
const TARGET_CHARS = 500; // segmentation budget (doc §4), used only if planning now
const DEFAULT_TARGET_LANGUAGES = ['en', 'zh'];

export interface StudyProgress {
  status: 'none' | 'partial' | 'complete';
  segments_total: number;
  segments_done: number;
  languages: string[];
  updated_at?: string;
}

export interface StudySource {
  source_type: StudySourceType;
  source_key: string;
  title: string;
  language: string;
  sentence_count: number;
  study: StudyProgress;
}

export interface StudySegmentRow {
  segment_index: number;
  status: 'pending' | 'generating' | 'done' | 'failed';
  char_count: number;
  seq_start: number;
  seq_end: number;
  chapter_index: number;
  languages_done: string[];
  provider: string | null;
  attempts: number;
  error: string | null;
}

export interface StudyStatus {
  totals: {
    segments_total: number;
    segments_done: number;
    generating: number;
    failed: number;
    status: 'none' | 'partial' | 'complete';
  };
  segments: StudySegmentRow[];
  loading: boolean;
  error: string;
}

// The atomic persisted in-flight unit (doc §7). Exactly these fields — two
// separate refs could restore out of order.
interface ActiveJob {
  jobId: string;
  provider: StudyProvider;
  sourceType: StudySourceType;
  sourceKey: string;
  segmentIndex: number;
  autoRun: boolean;
}

// Per-claim context needed to build the prompt and map the reply back to library
// seqs. Kept at MODULE scope (not in activeJob, whose shape is fixed) so it
// survives a panel remount within the same popup document; on a full popup death
// it is rebuilt from GET /status (recoverContext).
interface ClaimContext {
  slots: BookStudySlot[];
  targetLanguages: string[]; // claim's target_languages (primary already excluded)
  primaryLanguage: string;
  seqStart: number;
  seqEnd: number;
}
const CLAIM_CONTEXTS = new Map<string, ClaimContext>();
const ctxKey = (sourceType: string, sourceKey: string, segmentIndex: number): string =>
  `${sourceType}:${sourceKey}:${segmentIndex}`;

export function useBookStudyGenerator() {
  // ── Persisted user choices ────────────────────────────────────────────────
  const claimerId = usePersistedRef<string>('bookStudyClaimerId', '');
  const provider = usePersistedRef<StudyProvider>('bookStudyProvider', 'gemini');
  const targetLanguages = usePersistedRef<string[]>('bookStudyTargetLanguages', [...DEFAULT_TARGET_LANGUAGES]);
  const autoRun = usePersistedRef<boolean>('bookStudyAutoRun', false);
  const activeJob = usePersistedRef<ActiveJob | null>('bookStudyActiveJob', null);

  // ── Source list state ─────────────────────────────────────────────────────
  const sources = ref<StudySource[]>([]);
  const total = ref(0);
  const page = ref(1);
  const perPage = ref(20);
  const typeFilter = usePersistedRef<'all' | 'book' | 'article'>('bookStudyTypeFilter', 'all');
  const search = ref('');
  const loadingSources = ref(false);
  const sourcesError = ref('');

  // ── Per-source status drill-down (keyed by `${type}:${key}`) ───────────────
  const statusBySource = ref<Record<string, StudyStatus>>({});

  // ── In-flight segment display + loop control ──────────────────────────────
  const running = ref(false);
  const phase = ref('');
  const error = ref('');
  const result = ref('');
  const activeSourceKey = ref('');
  const { apiBaseUrl, apiBaseNormalized, syncApiEndpoint } = useApiEndpoint();

  // Single in-instance guard so the resume watcher and a Generate click can't
  // drive two loops at once.
  let active = false;
  let stopRequested = false;

  const keyOf = (sourceType: string, sourceKey: string): string => `${sourceType}:${sourceKey}`;
  const apiBase = (): string => apiBaseNormalized() || apiManager.getCurrentBaseUrl().replace(/\/+$/, '');
  const studyUrl = (path: string): string => `${apiBase()}${studyGenPath(path)}`;

  const ensureClaimer = (): void => {
    if (!claimerId.value) {
      claimerId.value = `bsg_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    }
  };

  // ── Provider bridge helpers (reuse the four `*_text_service` listeners) ────
  const sendTo = (jobProvider: StudyProvider, msg: Record<string, any>) =>
    chrome.runtime.sendMessage({ type: PROVIDER_MESSAGE_TYPE[jobProvider], ...msg });


  // ── Source listing ────────────────────────────────────────────────────────
  const loadSources = async (targetPage = 1): Promise<void> => {
    ensureClaimer();
    await syncApiEndpoint();
    loadingSources.value = true;
    sourcesError.value = '';
    try {
      const params = new URLSearchParams({
        type: typeFilter.value,
        page: String(Math.max(1, Math.floor(targetPage) || 1)),
        per_page: String(perPage.value),
      });
      if (search.value.trim()) params.set('q', search.value.trim());
      const res = await fetch(`${studyUrl('sources')}?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        sourcesError.value = `Failed to load sources (${res.status})`;
        return;
      }
      const json = await res.json();
      if (json && json.success === false) {
        sourcesError.value = json.error || 'Failed to load sources';
        return;
      }
      sources.value = Array.isArray(json?.items) ? (json.items as StudySource[]) : [];
      total.value = typeof json?.total === 'number' ? json.total : sources.value.length;
      page.value = typeof json?.page === 'number' ? json.page : targetPage;
      if (typeof json?.per_page === 'number') perPage.value = json.per_page;
    } catch (e: any) {
      sourcesError.value = e?.message || 'Failed to load sources';
    } finally {
      loadingSources.value = false;
    }
  };

  const setPage = (targetPage: number): Promise<void> => loadSources(targetPage);
  const refreshSources = (): Promise<void> => loadSources(page.value);

  const pageCount = computed(() =>
    Math.max(1, Math.ceil((total.value || 0) / Math.max(1, perPage.value))),
  );

  // ── Per-source status drill-down ──────────────────────────────────────────
  const emptyStatus = (): StudyStatus => ({
    totals: { segments_total: 0, segments_done: 0, generating: 0, failed: 0, status: 'none' },
    segments: [],
    loading: false,
    error: '',
  });

  const loadStatus = async (sourceType: string, sourceKey: string): Promise<StudyStatus | null> => {
    const k = keyOf(sourceType, sourceKey);
    const prev = statusBySource.value[k] || emptyStatus();
    statusBySource.value = { ...statusBySource.value, [k]: { ...prev, loading: true, error: '' } };
    try {
      const params = new URLSearchParams({ source_type: sourceType, source_key: sourceKey });
      const res = await fetch(`${studyUrl('status')}?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        statusBySource.value = {
          ...statusBySource.value,
          [k]: { ...prev, loading: false, error: `Failed to load status (${res.status})` },
        };
        return null;
      }
      const json = await res.json();
      if (json && json.success === false) {
        statusBySource.value = {
          ...statusBySource.value,
          [k]: { ...prev, loading: false, error: json.error || 'Failed to load status' },
        };
        return null;
      }
      const snapshot: StudyStatus = {
        totals: json?.totals || emptyStatus().totals,
        segments: Array.isArray(json?.segments) ? (json.segments as StudySegmentRow[]) : [],
        loading: false,
        error: '',
      };
      statusBySource.value = { ...statusBySource.value, [k]: snapshot };
      return snapshot;
    } catch (e: any) {
      statusBySource.value = {
        ...statusBySource.value,
        [k]: { ...prev, loading: false, error: e?.message || 'Failed to load status' },
      };
      return null;
    }
  };

  // Update a source's progress row in place from a fresh status snapshot (doc §7:
  // "update that source's progress in place ... and continue the loop").
  const refreshSource = async (sourceType: string, sourceKey: string): Promise<void> => {
    const snapshot = await loadStatus(sourceType, sourceKey);
    if (!snapshot) return;
    const idx = sources.value.findIndex((s) => s.source_type === sourceType && s.source_key === sourceKey);
    if (idx < 0) return;
    const src = sources.value[idx];
    const languages = new Set<string>(src.study?.languages || []);
    for (const seg of snapshot.segments) for (const l of seg.languages_done || []) languages.add(l);
    const updated: StudySource = {
      ...src,
      study: {
        status: snapshot.totals.status,
        segments_total: snapshot.totals.segments_total,
        segments_done: snapshot.totals.segments_done,
        languages: [...languages],
        updated_at: new Date().toISOString(),
      },
    };
    sources.value = [...sources.value.slice(0, idx), updated, ...sources.value.slice(idx + 1)];
  };

  // ── Target-language selection helpers ─────────────────────────────────────
  const isLanguageSelected = (code: string): boolean => targetLanguages.value.includes(code);
  const toggleLanguage = (code: string): void => {
    if (targetLanguages.value.includes(code)) {
      targetLanguages.value = targetLanguages.value.filter((c) => c !== code);
    } else {
      targetLanguages.value = [...targetLanguages.value, code];
    }
  };

  // ── Protocol calls ────────────────────────────────────────────────────────
  // Claim the next (or a specific) segment for a source. Plans on demand server-side.
  const claimNext = async (
    sourceType: StudySourceType,
    sourceKey: string,
    langs: string[],
  ): Promise<{ ok: boolean; item?: any; error?: string }> => {
    try {
      const res = await fetch(studyUrl('claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimer: claimerId.value,
          source_type: sourceType,
          source_key: sourceKey,
          limit: 1,
          languages: langs,
          target_chars: TARGET_CHARS,
        }),
      });
      if (!res.ok) return { ok: false, error: `Claim failed (${res.status})` };
      const json = await res.json();
      if (json && json.success === false) return { ok: false, error: json.error || 'Claim rejected' };
      const items = Array.isArray(json?.items) ? json.items : [];
      return { ok: true, item: items[0] };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Claim failed' };
    }
  };

  const releaseSegment = async (
    sourceType: string,
    sourceKey: string,
    segmentIndex: number,
    errorMsg: string,
  ): Promise<void> => {
    try {
      await fetch(studyUrl('release'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_key: sourceKey,
          segment_indexes: [segmentIndex],
          claimer: claimerId.value,
          error: errorMsg,
        }),
      });
    } catch (e) {
      logger.warn(LOG, 'release failed', e);
    }
  };

  const submitSegment = async (
    job: ActiveJob,
    parsed: ReturnType<typeof parseStudySegmentReply>,
    ctx: ClaimContext,
  ): Promise<{ ok: boolean; applied?: any; error?: string }> => {
    try {
      const languages = parsed.languages.length ? parsed.languages : ctx.targetLanguages;
      const res = await fetch(studyUrl('submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: job.sourceType,
          source_key: job.sourceKey,
          segment_index: job.segmentIndex,
          claimer: claimerId.value,
          provider: job.provider,
          languages,
          slots: parsed.slots,
          phrases: parsed.phrases,
          grammar_points: parsed.grammar_points,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.error || `Submit failed (${res.status})` };
      if (json && json.success === false) return { ok: false, error: json.error || 'Submit disabled' };
      if (json && json.ok) return { ok: true, applied: json.applied };
      return { ok: false, error: json?.status ? `Submit rejected (${json.status})` : 'Submit rejected' };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Submit failed' };
    }
  };

  // Rebuild a claim context from GET /status after a full popup death lost the
  // in-memory one. Slots are synthesized as a contiguous seq range (doc §4
  // guarantees no orphan slots / contiguous ranges), which is all the parser
  // needs to map n → seq — the slot text is only used when building the prompt.
  const recoverContext = async (job: ActiveJob): Promise<ClaimContext | null> => {
    const snapshot = await loadStatus(job.sourceType, job.sourceKey);
    const seg = snapshot?.segments.find((s) => s.segment_index === job.segmentIndex);
    if (!seg) return null;
    const slots: BookStudySlot[] = [];
    for (let seq = seg.seq_start; seq <= seg.seq_end; seq++) {
      slots.push({ n: seq - seg.seq_start + 1, seq, text: '' });
    }
    const src = sources.value.find((s) => s.source_type === job.sourceType && s.source_key === job.sourceKey);
    const primary = (src?.language || '').toLowerCase();
    const langs = targetLanguages.value.map((c) => c.toLowerCase()).filter((c) => c && c !== primary);
    return { slots, targetLanguages: langs, primaryLanguage: primary, seqStart: seg.seq_start, seqEnd: seg.seq_end };
  };

  const clearJob = (jobId: string): void => {
    phase.value = '';
    if (activeJob.value?.jobId === jobId) activeJob.value = null;
  };

  // Poll the provider job to a stable reply. Returns the answer text, or throws.
  const pollProviderJob = async (job: ActiveJob): Promise<string> => {
    let polls = 0;
    while (polls < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      polls++;
      if (activeJob.value?.jobId !== job.jobId) throw new Error('superseded');
      const s = await sendTo(job.provider, { action: 'status', jobId: job.jobId });
      const res = s?.result;
      if (!res) continue;
      if (res.status === 'done') return res.answer || '';
      if (res.status === 'failed' || res.status === 'unknown') {
        throw new Error(res.error || `${PROVIDER_LABELS[job.provider]} generation failed`);
      }
      // still generating -> keep polling
    }
    throw new Error(`Timed out waiting for the ${PROVIDER_LABELS[job.provider]} reply`);
  };

  // Drive ONE in-flight job to a terminal state: poll → parse → submit / release.
  // Returns the outcome; does NOT chain the next segment (the loop owns that).
  const driveJob = async (job: ActiveJob): Promise<'submitted' | 'empty' | 'failed' | 'gen_failed'> => {
    activeSourceKey.value = keyOf(job.sourceType, job.sourceKey);
    phase.value = `Generating (${PROVIDER_LABELS[job.provider]})…`;
    error.value = '';
    result.value = '';

    let answer: string;
    try {
      answer = await pollProviderJob(job);
    } catch (e: any) {
      const msg = e?.message || 'generation failed';
      if (msg === 'superseded') {
        return 'gen_failed';
      }
      error.value = msg;
      await releaseSegment(job.sourceType, job.sourceKey, job.segmentIndex, msg);
      CLAIM_CONTEXTS.delete(ctxKey(job.sourceType, job.sourceKey, job.segmentIndex));
      clearJob(job.jobId);
      return 'gen_failed';
    }

    phase.value = 'Parsing reply…';
    const ctx =
      CLAIM_CONTEXTS.get(ctxKey(job.sourceType, job.sourceKey, job.segmentIndex)) ||
      (await recoverContext(job));
    if (!ctx) {
      const msg = 'Could not recover segment context';
      error.value = msg;
      await releaseSegment(job.sourceType, job.sourceKey, job.segmentIndex, msg);
      clearJob(job.jobId);
      return 'failed';
    }

    const parsed = parseStudySegmentReply(answer, ctx.slots, { targetLanguages: ctx.targetLanguages });
    // Zero-yield reply = generation failure (doc §6).
    if (parsed.sentenceLineCount === 0 && parsed.sectionItemCount === 0) {
      const msg = 'Reply had no parseable study content';
      error.value = msg;
      await releaseSegment(job.sourceType, job.sourceKey, job.segmentIndex, msg);
      CLAIM_CONTEXTS.delete(ctxKey(job.sourceType, job.sourceKey, job.segmentIndex));
      clearJob(job.jobId);
      return 'empty';
    }

    phase.value = 'Submitting results…';
    const submitRes = await submitSegment(job, parsed, ctx);
    if (!submitRes.ok) {
      const msg = submitRes.error || 'Submit failed';
      error.value = msg;
      await releaseSegment(job.sourceType, job.sourceKey, job.segmentIndex, msg);
      clearJob(job.jobId);
      return 'failed';
    }

    const a = submitRes.applied || {};
    result.value =
      `Segment ${job.segmentIndex}: ${parsed.sentenceLineCount} sentence lines, ` +
      `${parsed.phrases.length} phrases, ${parsed.grammar_points.length} grammar points ` +
      `→ inserted ${a.sentences_inserted ?? 0}, links ${a.lang_links_filled ?? 0}, ` +
      `explanations ${a.explanations_filled ?? 0}.`;
    CLAIM_CONTEXTS.delete(ctxKey(job.sourceType, job.sourceKey, job.segmentIndex));
    clearJob(job.jobId);
    return 'submitted';
  };

  // Claim a segment, build the prompt, start the provider job, publish activeJob.
  // Returns the started job, or null (claim empty / start failed — released).
  const startSegment = async (
    sourceType: StudySourceType,
    sourceKey: string,
    primaryLanguage: string,
  ): Promise<{ job: ActiveJob | null; noPending?: boolean }> => {
    const langs = targetLanguages.value
      .map((c) => c.toLowerCase())
      .filter((c) => c && c !== (primaryLanguage || '').toLowerCase());
    phase.value = 'Claiming a segment…';
    const claim = await claimNext(sourceType, sourceKey, langs);
    if (!claim.ok) {
      error.value = claim.error || 'Claim failed';
      return { job: null };
    }
    if (!claim.item) return { job: null, noPending: true };

    const item = claim.item;
    const slots: BookStudySlot[] = Array.isArray(item.slots) ? item.slots : [];
    const targets: string[] = Array.isArray(item.target_languages) && item.target_languages.length
      ? item.target_languages.map((c: string) => String(c).toLowerCase())
      : langs;
    const primary = String(item.primary_language || primaryLanguage || 'en').toLowerCase();
    const ctx: ClaimContext = {
      slots,
      targetLanguages: targets,
      primaryLanguage: primary,
      seqStart: item.seq_start,
      seqEnd: item.seq_end,
    };
    CLAIM_CONTEXTS.set(ctxKey(sourceType, sourceKey, item.segment_index), ctx);

    const prompt = buildBookStudySegmentPrompt(slots, primary, targets);
    phase.value = `Starting (${PROVIDER_LABELS[provider.value]})…`;
    const jobProvider = provider.value;
    let startResp: any;
    try {
      startResp = await sendWithWake(
        () => sendTo(jobProvider, { action: 'start', prompt, timeoutMs: START_TIMEOUT_MS }),
        PROVIDER_LABELS[jobProvider],
      );
    } catch (e: any) {
      const msg = `Failed to start ${PROVIDER_LABELS[jobProvider]}: ${e?.message || 'unknown error'}`;
      error.value = msg;
      await releaseSegment(sourceType, sourceKey, item.segment_index, msg);
      CLAIM_CONTEXTS.delete(ctxKey(sourceType, sourceKey, item.segment_index));
      return { job: null };
    }
    const jobId = startResp?.result?.jobId;
    if (!startResp?.success || !jobId) {
      const detail =
        startResp?.result?.error ||
        startResp?.error ||
        (startResp === undefined ? 'no response from the background service worker' : 'unexpected response');
      const msg = `Failed to start ${PROVIDER_LABELS[jobProvider]}: ${detail}`;
      error.value = msg;
      await releaseSegment(sourceType, sourceKey, item.segment_index, msg);
      CLAIM_CONTEXTS.delete(ctxKey(sourceType, sourceKey, item.segment_index));
      return { job: null };
    }
    logger.info(LOG, `start (${jobProvider}): job ${jobId} for ${sourceType}/${sourceKey} segment ${item.segment_index}`);
    const job: ActiveJob = {
      jobId,
      provider: jobProvider,
      sourceType,
      sourceKey,
      segmentIndex: item.segment_index,
      autoRun: autoRun.value,
    };
    activeJob.value = job; // publish before driving (survives popup death)
    return { job };
  };

  // ── The generate loop (a Generate click or a resumed job) ─────────────────
  const runFrom = async (
    sourceType: StudySourceType,
    sourceKey: string,
    primaryLanguage: string,
    existingJob?: ActiveJob,
  ): Promise<void> => {
    if (active) return;
    active = true;
    stopRequested = false;
    running.value = true;
    activeSourceKey.value = keyOf(sourceType, sourceKey);
    try {
      // Resume path: drive the already-started job first.
      if (existingJob?.jobId) {
        const res = await driveJob(existingJob);
        await refreshSource(sourceType, sourceKey);
        if (res !== 'submitted') return; // failure/superseded already handled
        if (!existingJob.autoRun || !autoRun.value) return;
      }
      // Claim → drive → submit, repeating while Auto-run is on and work remains.
      while (!stopRequested) {
        const started = await startSegment(sourceType, sourceKey, primaryLanguage);
        if (started.noPending) {
          phase.value = 'No pending segments';
          break;
        }
        if (!started.job) break; // claim/start failure (error already set)
        const res = await driveJob(started.job);
        await refreshSource(sourceType, sourceKey);
        if (res !== 'submitted') break; // failure released; stop the loop
        if (!autoRun.value) break; // single segment unless Auto-run
      }
    } finally {
      active = false;
      running.value = false;
      phase.value = '';
    }
  };

  const generate = (source: StudySource): Promise<void> => {
    if (active) return Promise.resolve();
    error.value = '';
    result.value = '';
    return runFrom(source.source_type, source.source_key, source.language || 'en');
  };

  const stop = (): void => {
    stopRequested = true;
  };

  // Resume an in-flight job after usePersistedRef restores it on mount (popup was
  // reopened mid-generation). Fires once the async chrome.storage.local read lands.
  watch(activeJob, (job) => {
    if (job?.jobId && !active) {
      const src = sources.value.find((s) => s.source_type === job.sourceType && s.source_key === job.sourceKey);
      void runFrom(job.sourceType, job.sourceKey, src?.language || 'en', job);
    }
  });

  const initPanel = async (): Promise<void> => {
    await logger.init().catch(() => {});
    await syncApiEndpoint();
    ensureClaimer();
    await loadSources(1);
  };

  return {
    // choices
    provider,
    targetLanguages,
    autoRun,
    claimerId,
    isLanguageSelected,
    toggleLanguage,
    // sources
    sources,
    total,
    page,
    perPage,
    pageCount,
    typeFilter,
    search,
    loadingSources,
    sourcesError,
    loadSources,
    setPage,
    refreshSources,
    // status
    statusBySource,
    loadStatus,
    keyOf,
    // loop / in-flight
    running,
    phase,
    error,
    result,
    activeJob,
    activeSourceKey,
    generate,
    stop,
    // endpoint
    apiBaseUrl,
    initPanel,
  };
}
