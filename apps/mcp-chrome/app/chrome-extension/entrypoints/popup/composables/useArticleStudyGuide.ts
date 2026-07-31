/**
 * Article Study Guide composable (popup).
 * Same logic for every web-chat provider — only the background message type
 * differs, since each provider's tool exposes the identical start/status job
 * contract (web-chat-job-base.ts). Drives whichever provider is selected via
 * its `<provider>_text_service` bridge so a slow multi-section reply keeps
 * being awaited even if the popup is closed (Chrome destroys browser-action
 * popups on blur) and later reopened — the in-flight job is persisted as one
 * atomic {jobId, provider} value, and a watcher resumes polling it as soon as
 * it is restored on mount.
 *
 * `languages` / `sourceLanguageSkipExpressions` are intentionally plain
 * (non-persisted) refs: an earlier persisted version let a stale toggle from
 * a prior test linger across code changes (e.g. a default silently no longer
 * matching what was actually shown), so this panel always starts from the
 * current code defaults on each popup open.
 */
import { ref, watch } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { logger } from '@/utils/logger';
import { getMessage } from '@/utils/i18n';
import { sendWithWake } from '@/utils/sendWithWake';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import {
  DEFAULT_GEMINI_TRANSLATE_LANGUAGES,
  buildGeminiArticleTranslatePrompt,
  type GeminiTranslateLangOption,
} from './promptPresets';

const LOG = 'Article Study Guide Client';

export type ArticleStudyGuideProvider = 'gemini' | 'chatgpt' | 'grok' | 'copilot';

export const PROVIDER_MESSAGE_TYPE: Record<ArticleStudyGuideProvider, string> = {
  gemini: FEATURE_MESSAGE_TYPES.GEMINI_TEXT,
  chatgpt: FEATURE_MESSAGE_TYPES.CHATGPT_TEXT,
  grok: FEATURE_MESSAGE_TYPES.GROK_TEXT,
  copilot: FEATURE_MESSAGE_TYPES.COPILOT_TEXT,
};

export const PROVIDER_LABELS: Record<ArticleStudyGuideProvider, string> = {
  gemini: 'Gemini',
  chatgpt: 'ChatGPT',
  grok: 'Grok',
  copilot: 'Copilot',
};

export const PROVIDER_ORDER: ArticleStudyGuideProvider[] = ['gemini', 'chatgpt', 'grok', 'copilot'];

interface ActiveJob {
  jobId: string;
  provider: ArticleStudyGuideProvider;
}

// Poll cadence + ceiling for the async status loop (mirrors useGeminiImage.ts).
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100; // ~5 min per (re)poll session
const START_TIMEOUT_MS = 240000;

export function useArticleStudyGuide() {
  const provider = usePersistedRef<ArticleStudyGuideProvider>('articleStudyGuideProvider', 'gemini');
  const article = ref('');
  const languages = ref<GeminiTranslateLangOption[]>(DEFAULT_GEMINI_TRANSLATE_LANGUAGES.map((l) => ({ ...l })));
  const sourceLanguageSkipExpressions = ref(true);
  // Persisted as one atomic value so jobId + provider always restore together
  // (two separate persisted refs could resolve out of order on mount).
  const activeJob = usePersistedRef<ActiveJob | null>('articleStudyGuideActiveJob', null);

  const testing = ref(false);
  const phase = ref('');
  const error = ref('');
  const result = ref('');

  let polling = false;

  const sendTo = (jobProvider: ArticleStudyGuideProvider, msg: Record<string, any>) =>
    chrome.runtime.sendMessage({ type: PROVIDER_MESSAGE_TYPE[jobProvider], ...msg });


  const finishJob = (jobId: string) => {
    polling = false;
    testing.value = false;
    phase.value = '';
    if (activeJob.value?.jobId === jobId) activeJob.value = null;
  };

  const pollJob = async (jobId: string, jobProvider: ArticleStudyGuideProvider) => {
    if (polling) return;
    polling = true;
    testing.value = true;
    phase.value = `Generating (${PROVIDER_LABELS[jobProvider]})…`;
    try {
      let polls = 0;
      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        polls++;
        if (activeJob.value?.jobId !== jobId) return; // superseded by a newer run
        const s = await sendTo(jobProvider, { action: 'status', jobId });
        const res = s?.result;
        if (!res) continue;
        if (res.status === 'done') {
          result.value = res.answer || getMessage('noAnswerReturned');
          finishJob(jobId);
          return;
        }
        if (res.status === 'failed' || res.status === 'unknown') {
          error.value = res.error || getMessage('providerGenerationFailed', [PROVIDER_LABELS[jobProvider]]);
          finishJob(jobId);
          return;
        }
        // still generating -> keep polling
      }
      error.value = getMessage('providerReplyTimeout', [PROVIDER_LABELS[jobProvider]]);
      finishJob(jobId);
    } catch (e: any) {
      error.value = e?.message || getMessage('providerGenerationFailed', [PROVIDER_LABELS[jobProvider]]);
      logger.error(LOG, 'poll failed', e);
      finishJob(jobId);
    }
  };

  const runTest = async () => {
    const text = article.value.trim();
    if (!text || testing.value) return;
    const jobProvider = provider.value;
    testing.value = true;
    error.value = '';
    result.value = '';
    phase.value = `Submitting (${PROVIDER_LABELS[jobProvider]})…`;
    try {
      // Defensive: drop any malformed entry instead of letting it throw during
      // prompt build (e.g. a leftover shape from an earlier build).
      const validLanguages = (languages.value || []).filter(
        (l): l is GeminiTranslateLangOption => !!l && typeof l.code === 'string' && l.code.trim().length > 0,
      );
      const prompt = buildGeminiArticleTranslatePrompt(
        text,
        validLanguages.length ? validLanguages : DEFAULT_GEMINI_TRANSLATE_LANGUAGES,
        sourceLanguageSkipExpressions.value,
      );
      logger.info(LOG, `start (${jobProvider}): prompt built (${prompt.length} chars), sending to background`);
      const startResp = await sendWithWake(
        () => sendTo(jobProvider, { action: 'start', prompt, timeoutMs: START_TIMEOUT_MS }),
        PROVIDER_LABELS[jobProvider],
      );
      const jobId = startResp?.result?.jobId;
      if (!startResp?.success || !jobId) {
        const detail =
          startResp?.result?.error ||
          startResp?.error ||
          (startResp === undefined
            ? 'no response from the background service worker (it may have been asleep or restarted — try again)'
            : `unexpected response: ${JSON.stringify(startResp)}`);
        error.value = getMessage('providerTestStartFailed', [PROVIDER_LABELS[jobProvider], detail]);
        logger.error(LOG, 'start rejected', detail);
        testing.value = false;
        phase.value = '';
        return;
      }
      logger.info(LOG, `start (${jobProvider}): job ${jobId} on tab ${startResp.result.tabId}`);
      activeJob.value = { jobId, provider: jobProvider };
      await pollJob(jobId, jobProvider);
    } catch (e: any) {
      const detail = e?.message || (e ? String(e) : getMessage('unknownErrorMessage'));
      error.value = getMessage('providerTestStartFailed', [PROVIDER_LABELS[jobProvider], detail]);
      logger.error(LOG, 'start threw', e);
      testing.value = false;
      phase.value = '';
    }
  };

  // Resume an in-flight job after usePersistedRef restores it (popup reopened
  // mid-generation): fires once the async chrome.storage.local read lands.
  watch(activeJob, (job) => {
    if (job?.jobId && !polling) pollJob(job.jobId, job.provider);
  });

  return {
    provider,
    article,
    languages,
    sourceLanguageSkipExpressions,
    testing,
    phase,
    error,
    result,
    runTest,
  };
}
