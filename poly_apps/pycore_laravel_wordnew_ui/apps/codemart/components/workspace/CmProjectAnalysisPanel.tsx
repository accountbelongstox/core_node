import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmProjectAnalysis, CmProjectDetail } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { cmFormatNumber, useCmFormat } from './cmWorkspaceFormat';

const ANALYSIS_POLL_MS = 4000;
const ACTIVE_ANALYSIS_STATUSES = new Set(['pending', 'processing', 'revising']);
const DRAFT_STATUS = 'draft';
const PROPOSAL_REVIEW_STATUS = 'proposal_review';
const COMPLETED_STATUS = 'completed';
const FAILED_STATUS = 'failed';
const REVISION_MIN_LENGTH = 10;
const LIST_FIELDS = [
  { key: 'keywords', labelKey: 'analysis.keywords' },
  { key: 'recommended_languages', labelKey: 'analysis.languages' },
  { key: 'recommended_frameworks', labelKey: 'analysis.frameworks' },
  { key: 'recommended_databases', labelKey: 'analysis.databases' },
] as const;

interface CmProjectAnalysisPanelProps {
  project: CmProjectDetail;
  isOwner: boolean;
  onProjectChanged: () => Promise<void>;
}

/** Latest server-side AI analysis of the project; polls while the analysis is running. */
export const CmProjectAnalysisPanel: React.FC<CmProjectAnalysisPanelProps> = ({ project, isOwner, onProjectChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const [data, setData] = useState<CmProjectAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevision, setShowRevision] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const wasActive = useRef(false);
  const projectChangedRef = useRef(onProjectChanged);
  projectChangedRef.current = onProjectChanged;

  const load = useCallback(async (): Promise<void> => {
    const response = await cmApi.getProjectAnalysis(project.id);
    setLoading(false);
    if (!response.success || !response.data) {
      setLoadError(cmErrorMessage(t, response, 'analysis.loadFailed'));
      return;
    }
    setLoadError(null);
    const active = ACTIVE_ANALYSIS_STATUSES.has(response.data.analysis?.status ?? '');
    setData(response.data);
    if (wasActive.current && !active) {
      await projectChangedRef.current();
    }
    wasActive.current = active;
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    pollTimer.current = active ? window.setTimeout(() => { void load(); }, ANALYSIS_POLL_MS) : null;
  }, [project.id, t]);

  useEffect(() => {
    void load();
    return () => {
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    };
  }, [load]);

  const analysis = data?.analysis ?? null;
  const active = ACTIVE_ANALYSIS_STATUSES.has(analysis?.status ?? '');
  const canAnalyze = isOwner && project.status === DRAFT_STATUS && !active;
  const canRevise = isOwner && analysis?.status === COMPLETED_STATUS && !analysis.accepted_at && project.status === PROPOSAL_REVIEW_STATUS;
  const revisionValid = revisionNotes.trim().length >= REVISION_MIN_LENGTH;

  const analyze = async (): Promise<void> => {
    setBusy(true);
    notice.clear();
    const response = await cmApi.analyzeProject(project.id);
    setBusy(false);
    if (response.success) notice.success(t('analysis.started'));
    else notice.error(cmErrorMessage(t, response, 'analysis.startFailed'));
    await load();
  };

  const accept = async (): Promise<void> => {
    if (!analysis) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.acceptAnalysis(analysis.analysis_id);
    setBusy(false);
    if (response.success) {
      notice.success(t('analysis.acceptedWithAmount', { amount: format.money(response.data?.funding_amount ?? '', project.currency) }));
      await load();
      await onProjectChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'analysis.acceptFailed'));
    }
  };

  const requestRevision = async (): Promise<void> => {
    if (!analysis || !revisionValid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.requestAnalysisRevision(analysis.analysis_id, revisionNotes.trim());
    setBusy(false);
    if (response.success) {
      notice.success(t('analysis.revisionSent'));
      setShowRevision(false);
      setRevisionNotes('');
      await load();
      await onProjectChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'analysis.revisionFailed'));
    }
  };

  return (
    <section className="cm-section-card cm-analysis-panel">
      <h2><Sparkles aria-hidden="true" /> {t('analysis.title')}</h2>
      <p className="cm-section-card__lead">{t('analysis.lead')}</p>
      {loading ? (
        <CmLoadingState compact />
      ) : loadError ? (
        <CmErrorState compact message={loadError} onRetry={() => void load()} />
      ) : !analysis ? (
        <p className="cm-field-hint">{isOwner && project.status === DRAFT_STATUS ? t('analysis.noneOwner') : t('analysis.none')}</p>
      ) : (
        <div className="cm-analysis-result">
          <div className="cm-record-card__meta">
            <CmStatusBadge group="analysis" prefix="analysis.statuses" status={analysis.status} />
            <span>{t('analysis.revisionLabel', { revision: analysis.revision ?? 1 })}</span>
            {analysis.accepted_at && <span className="cm-status" data-status="approved">{t('analysis.acceptedBadge')}</span>}
          </div>
          {active && <p className="cm-analysis-waiting"><Loader2 aria-hidden="true" className="cm-spin" /> {t('analysis.waiting')}</p>}
          {analysis.status === FAILED_STATUS && <CmNotice notice={{ tone: 'error', text: t('analysis.failedHint') }} />}
          {analysis.status === COMPLETED_STATUS && (
            <>
              <dl className="cm-kv">
                {analysis.estimated_cost !== null && <div><dt>{t('analysis.costLabel')}</dt><dd>{format.money(analysis.estimated_cost, project.currency)}</dd></div>}
                {analysis.estimated_hours !== null && <div><dt>{t('analysis.hoursLabel')}</dt><dd>{t('analysis.hoursValue', { hours: cmFormatNumber(analysis.estimated_hours, format.language) })}</dd></div>}
                {analysis.complexity_score !== null && <div><dt>{t('analysis.complexityLabel')}</dt><dd>{analysis.complexity_score}</dd></div>}
              </dl>
              {analysis.proposal && (
                <div className="cm-analysis-proposal-block">
                  <h3>{t('analysis.proposalTitle')}</h3>
                  <p className="cm-analysis-proposal">{analysis.proposal}</p>
                </div>
              )}
              {LIST_FIELDS.map((field) => {
                const values = (analysis[field.key] ?? []) as string[];
                return values.length > 0 ? (
                  <div key={field.key} className="cm-stack-list__row">
                    <span>{t(field.labelKey)}</span>
                    <ul className="cm-chip-list">{values.map((value) => <li key={value}>{value}</li>)}</ul>
                  </div>
                ) : null;
              })}
              {analysis.revision_notes && <p className="cm-field-hint">{t('analysis.revisionNotes')}: {analysis.revision_notes}</p>}
              {(data?.can_accept || canRevise) && (
                <div className="cm-table-actions cm-section-card__actions">
                  {data?.can_accept && (
                    <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void accept()}>
                      {busy ? t('common.saving') : t('analysis.accept')}
                    </button>
                  )}
                  {canRevise && (
                    <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setShowRevision((value) => !value)} aria-expanded={showRevision}>
                      {t('analysis.requestRevision')}
                    </button>
                  )}
                </div>
              )}
              {data?.can_accept && <p className="cm-field-hint">{t('analysis.acceptHint')}</p>}
              {showRevision && (
                <div className="cm-analysis-revision">
                  <label className="cm-stacked-field">
                    <span>{t('analysis.revisionLabelField')}</span>
                    <textarea
                      rows={3}
                      value={revisionNotes}
                      onChange={(event) => setRevisionNotes(event.target.value)}
                      placeholder={t('analysis.revisionPlaceholder')}
                    />
                    {revisionNotes !== '' && !revisionValid && <small className="cm-field-error">{t('analysis.revisionTooShort', { min: REVISION_MIN_LENGTH })}</small>}
                  </label>
                  <div className="cm-table-actions">
                    <button type="button" className="cm-workspace-button is-primary" disabled={busy || !revisionValid} onClick={() => void requestRevision()}>
                      {t('analysis.sendRevision')}
                    </button>
                    <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setShowRevision(false)}>{t('common.cancel')}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {canAnalyze && (
        <div className="cm-section-card__actions">
          <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void analyze()}>
            <Sparkles aria-hidden="true" /> {busy ? t('analysis.starting') : (analysis?.status === FAILED_STATUS ? t('analysis.retry') : t('analysis.run'))}
          </button>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmProjectAnalysisPanel;
