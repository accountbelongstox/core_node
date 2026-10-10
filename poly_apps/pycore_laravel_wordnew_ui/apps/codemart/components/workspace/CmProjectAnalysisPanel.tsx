import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../api/CmApiTypes';
import {
  CM_ANALYSIS_COMPLETED_STATUS,
  CM_ANALYSIS_FAILED_STATUS,
  CM_ANALYSIS_REVISION_MIN_LENGTH,
  useCmProjectAnalysis,
} from '../../shared/useCmProjectAnalysis';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { cmFormatNumber, useCmFormat } from './cmWorkspaceFormat';

const DRAFT_STATUS = 'draft';
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
  const model = useCmProjectAnalysis(project, isOwner, onProjectChanged, notice);
  const { data, analysis, loading, loadError, busy, active, analysisAvailable, stuckWithoutWorker, canAnalyze, canRevise, revisionNotes, revisionValid } = model;
  const [showRevision, setShowRevision] = useState(false);

  const requestRevision = async (): Promise<void> => {
    if (await model.requestRevision()) setShowRevision(false);
  };

  return (
    <section className="cm-section-card cm-analysis-panel">
      <h2><Sparkles aria-hidden="true" /> {t('analysis.title')}</h2>
      <p className="cm-section-card__lead">{t('analysis.lead')}</p>
      {loading ? (
        <CmLoadingState compact />
      ) : loadError ? (
        <CmErrorState compact message={loadError} onRetry={() => void model.reload()} />
      ) : !analysis ? (
        isOwner && project.status === DRAFT_STATUS
          ? (analysisAvailable ? <p className="cm-field-hint">{t('analysis.noneOwner')}</p> : null)
          : <p className="cm-field-hint">{t('analysis.none')}</p>
      ) : (
        <div className="cm-analysis-result">
          <div className="cm-record-card__meta">
            <CmStatusBadge group="analysis" prefix="analysis.statuses" status={analysis.status} />
            <span>{t('analysis.revisionLabel', { revision: analysis.revision ?? 1 })}</span>
            {analysis.accepted_at && <span className="cm-status" data-status="approved">{t('analysis.acceptedBadge')}</span>}
          </div>
          {active && !stuckWithoutWorker && <p className="cm-analysis-waiting"><Loader2 aria-hidden="true" className="cm-spin" /> {t('analysis.waiting')}</p>}
          {stuckWithoutWorker && <CmNotice notice={{ tone: 'info', text: t('analysis.notProcessed') }} />}
          {analysis.status === CM_ANALYSIS_FAILED_STATUS && <CmNotice notice={{ tone: 'error', text: t('analysis.failedHint') }} />}
          {analysis.status === CM_ANALYSIS_COMPLETED_STATUS && (
            <>
              <dl className="cm-kv">
                {analysis.estimated_cost !== null && <div><dt>{t('analysis.costLabel')}</dt><dd>{format.money(analysis.estimated_cost, analysis.currency ?? project.currency)}</dd></div>}
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
                    <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void model.accept()}>
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
                      onChange={(event) => model.setRevisionNotes(event.target.value)}
                      placeholder={t('analysis.revisionPlaceholder')}
                    />
                    {revisionNotes !== '' && !revisionValid && <small className="cm-field-error">{t('analysis.revisionTooShort', { min: CM_ANALYSIS_REVISION_MIN_LENGTH })}</small>}
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
      {model.canConfirmBudget && (
        <div className="cm-section-card__actions cm-analysis-fallback">
          <p className="cm-field-hint">{t('analysis.budgetFallbackHint', { amount: format.money(project.budget ?? '', project.currency) })}</p>
          <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void model.confirmBudget()}>
            {busy ? t('common.saving') : t('analysis.confirmBudget')}
          </button>
        </div>
      )}
      {canAnalyze && (
        <div className="cm-section-card__actions">
          <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void model.analyze()}>
            <Sparkles aria-hidden="true" /> {busy ? t('analysis.starting') : (analysis?.status === CM_ANALYSIS_FAILED_STATUS ? t('analysis.retry') : t('analysis.run'))}
          </button>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmProjectAnalysisPanel;
