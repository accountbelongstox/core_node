import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmAiAnalysis, CmProjectAnalysis, CmProjectDetail } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmIdempotencyKey } from '../api/useCmIdempotencyKey';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmFeedback } from './cmFeedback';

const ANALYSIS_POLL_MS = 4000;
const DRAFT_STATUS = 'draft';
const PROPOSAL_REVIEW_STATUS = 'proposal_review';
export const CM_ANALYSIS_COMPLETED_STATUS = 'completed';
export const CM_ANALYSIS_FAILED_STATUS = 'failed';
export const CM_ANALYSIS_REVISION_MIN_LENGTH = 10;

export interface CmProjectAnalysisModel {
  data: CmProjectAnalysis | null;
  analysis: CmAiAnalysis | null;
  loading: boolean;
  loadError: string | null;
  busy: boolean;
  active: boolean;
  analysisAvailable: boolean;
  stuckWithoutWorker: boolean;
  canAnalyze: boolean;
  canRevise: boolean;
  /** Owner may confirm the project's own budget while the AI analysis is switched off. */
  canConfirmBudget: boolean;
  revisionNotes: string;
  setRevisionNotes: (value: string) => void;
  revisionValid: boolean;
  reload: () => Promise<void>;
  analyze: () => Promise<void>;
  accept: () => Promise<boolean>;
  confirmBudget: () => Promise<boolean>;
  requestRevision: () => Promise<boolean>;
}

/** Latest server-side AI analysis of the project; polls while the analysis runs. */
export function useCmProjectAnalysis(project: CmProjectDetail, isOwner: boolean, onProjectChanged: () => Promise<void>, feedback: CmFeedback): CmProjectAnalysisModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const { openStates } = useCmBootstrap();
  const activeStates = openStates('analysis');
  const activeStatesRef = useRef(activeStates);
  activeStatesRef.current = activeStates;
  const [data, setData] = useState<CmProjectAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const pollTimer = useRef<number | null>(null);
  const wasActive = useRef(false);
  const aliveRef = useRef(false);
  const generationRef = useRef(0);
  const projectChangedRef = useRef(onProjectChanged);
  projectChangedRef.current = onProjectChanged;
  const translate = useRef(t);
  translate.current = t;

  const loadRef = useRef<() => Promise<void>>(async () => undefined);

  /** While an analysis runs, poll just that analysis (`GET /ai-analysis/{id}`); the full view reloads once it settles. */
  const pollAnalysis = useCallback(async (analysisId: number): Promise<void> => {
    const generation = generationRef.current;
    const isCurrent = (): boolean => aliveRef.current && generation === generationRef.current;
    const response = await cmApi.getAnalysisResult(analysisId);
    if (!isCurrent()) return;
    const stillActive = response.success && response.data !== null && activeStatesRef.current.includes(response.data.status);
    if (stillActive) {
      pollTimer.current = window.setTimeout(() => { void pollAnalysis(analysisId); }, ANALYSIS_POLL_MS);
      return;
    }
    await loadRef.current();
  }, []);

  const load = useCallback(async (): Promise<void> => {
    const generation = generationRef.current;
    const isCurrent = (): boolean => aliveRef.current && generation === generationRef.current;
    if (!isCurrent()) return;
    const response = await cmApi.getProjectAnalysis(project.id);
    if (!isCurrent()) return;
    setLoading(false);
    if (!response.success || !response.data) {
      setLoadError(cmErrorMessage(translate.current, response, 'analysis.loadFailed'));
      return;
    }
    setLoadError(null);
    // Never poll when the analysis task is switched off: a row stuck in
    // processing/revising will never finish, so treat it as inactive.
    const taskEnabled = response.data.analysis_available !== false;
    const active = taskEnabled && activeStatesRef.current.includes(response.data.analysis?.status ?? '');
    setData(response.data);
    if (wasActive.current && !active) {
      await projectChangedRef.current();
      if (!isCurrent()) return;
    }
    wasActive.current = active;
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    const activeId = response.data.analysis?.analysis_id ?? null;
    pollTimer.current = active && activeId !== null
      ? window.setTimeout(() => { void pollAnalysis(activeId); }, ANALYSIS_POLL_MS)
      : null;
  }, [project.id, pollAnalysis]);
  loadRef.current = load;

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => {
      aliveRef.current = false;
      generationRef.current += 1;
      wasActive.current = false;
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
  }, [load]);

  const analysis = data?.analysis ?? null;
  const analysisId = analysis?.analysis_id ?? null;

  useEffect(() => {
    idempotency.reset();
  }, [analysisId, idempotency.reset]);

  const active = activeStates.includes(analysis?.status ?? '');
  const analysisAvailable = data?.analysis_available !== false;
  const stuckWithoutWorker = active && !analysisAvailable;
  const canAnalyze = isOwner && project.status === DRAFT_STATUS && !active && analysisAvailable;
  const canRevise = isOwner && analysisAvailable && analysis?.status === CM_ANALYSIS_COMPLETED_STATUS && !analysis.accepted_at && project.status === PROPOSAL_REVIEW_STATUS;
  const canConfirmBudget = !loading && !analysisAvailable && isOwner && project.status === DRAFT_STATUS;
  const revisionValid = revisionNotes.trim().length >= CM_ANALYSIS_REVISION_MIN_LENGTH;

  const analyze = useCallback(async (): Promise<void> => {
    setBusy(true);
    feedback.clear();
    const response = await cmApi.analyzeProject(project.id);
    setBusy(false);
    if (response.success) feedback.success(t('analysis.started'));
    else feedback.error(cmErrorMessage(t, response, 'analysis.startFailed'));
    await load();
  }, [project.id, feedback, load, t]);

  const accept = useCallback(async (): Promise<boolean> => {
    if (!analysis) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.acceptAnalysis(analysis.analysis_id, idempotency.current());
    setBusy(false);
    if (response.success) {
      idempotency.reset();
      feedback.success(t('analysis.acceptedWithAmount', { amount: format.money(response.data?.funding_amount ?? '', analysis.currency ?? project.currency) }));
      await load();
      await onProjectChanged();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'analysis.acceptFailed'));
    return false;
  }, [analysis, feedback, idempotency, format, project.currency, load, onProjectChanged, t]);

  const confirmBudget = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    feedback.clear();
    const response = await cmApi.confirmProjectBudget(project.id);
    setBusy(false);
    if (response.success) {
      feedback.success(t('analysis.budgetConfirmed'));
      await onProjectChanged();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'analysis.confirmBudgetFailed'));
    return false;
  }, [project.id, feedback, onProjectChanged, t]);

  const requestRevision = useCallback(async (): Promise<boolean> => {
    if (!analysis || !revisionValid) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.requestAnalysisRevision(analysis.analysis_id, revisionNotes.trim());
    setBusy(false);
    if (response.success) {
      feedback.success(t('analysis.revisionSent'));
      setRevisionNotes('');
      await load();
      await onProjectChanged();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'analysis.revisionFailed'));
    return false;
  }, [analysis, revisionValid, revisionNotes, feedback, load, onProjectChanged, t]);

  return {
    data, analysis, loading, loadError, busy, active, analysisAvailable, stuckWithoutWorker, canAnalyze, canRevise, canConfirmBudget,
    revisionNotes, setRevisionNotes, revisionValid, reload: load, analyze, accept, confirmBudget, requestRevision,
  };
}
