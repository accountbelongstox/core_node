import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../../../api/CmApiTypes';
import { cmFormatNumber, useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import {
  CM_ANALYSIS_COMPLETED_STATUS,
  CM_ANALYSIS_FAILED_STATUS,
  CM_ANALYSIS_REVISION_MIN_LENGTH,
  useCmProjectAnalysis,
} from '../../../../shared/useCmProjectAnalysis';
import { MobileButton, MobileCard, MobileErrorState, MobileField, MobileNotice, MobileSectionHeader, MobileSheet, MobileSkeletonBlock, MobileStatusBadge, useMobileFeedback, MobileConfirmSheet, MobileKeyValues, MobileTagList } from '../../../ui';

const LIST_FIELDS = [
  { key: 'keywords', labelKey: 'analysis.keywords' },
  { key: 'recommended_languages', labelKey: 'analysis.languages' },
  { key: 'recommended_frameworks', labelKey: 'analysis.frameworks' },
  { key: 'recommended_databases', labelKey: 'analysis.databases' },
] as const;

interface ProjectAnalysisTabProps {
  project: CmProjectDetail;
  isOwner: boolean;
  onProjectChanged: () => Promise<void>;
}

/** AI analysis of the project: start or retry, polling status, proposal with accept (idempotent) or revision request, own-budget confirmation when analysis is off. */
export const ProjectAnalysisTab: React.FC<ProjectAnalysisTabProps> = ({ project, isOwner, onProjectChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const model = useCmProjectAnalysis(project, isOwner, onProjectChanged, feedback);
  const { data, analysis, loading, loadError, busy, active, stuckWithoutWorker, canAnalyze, canRevise, canConfirmBudget, revisionNotes, revisionValid } = model;
  const [revising, setRevising] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const draft = project.status === 'draft';
  const completed = analysis?.status === CM_ANALYSIS_COMPLETED_STATUS;

  const sendRevision = async (): Promise<void> => {
    if (await model.requestRevision()) setRevising(false);
  };

  const accept = async (): Promise<void> => {
    await model.accept();
    setAccepting(false);
  };

  return (
    <>
      <MobileCard>
        <h3 className="cmm-card-title"><Sparkles aria-hidden="true" /> {t('analysis.title')}</h3>
        <p className="cmm-card-lead">{t('analysis.lead')}</p>
        {loading ? <MobileSkeletonBlock height={120} /> : loadError ? (
          <MobileErrorState message={loadError} onRetry={() => void model.reload()} />
        ) : !analysis ? (
          isOwner && draft ? (model.analysisAvailable ? <p className="cmm-hint">{t('analysis.noneOwner')}</p> : null) : <p className="cmm-hint">{t('analysis.none')}</p>
        ) : (
          <div className="cmm-stack-tight">
            <div className="cmm-row-actions">
              <MobileStatusBadge prefix="analysis.statuses" status={analysis.status} />
              <span className="cmm-badge">{t('analysis.revisionLabel', { revision: analysis.revision ?? 1 })}</span>
              {analysis.accepted_at && <span className="cmm-badge" data-tone="success">{t('analysis.acceptedBadge')}</span>}
            </div>
            {active && !stuckWithoutWorker && <p className="cmm-hint"><Loader2 className="cmm-spin" size={14} aria-hidden="true" /> {t('analysis.waiting')}</p>}
            {stuckWithoutWorker && <MobileNotice>{t('analysis.notProcessed')}</MobileNotice>}
            {analysis.status === CM_ANALYSIS_FAILED_STATUS && <MobileNotice tone="error">{t('analysis.failedHint')}</MobileNotice>}
            {completed && (
              <>
                <MobileKeyValues
                  items={[
                    analysis.estimated_cost !== null && { label: t('analysis.costLabel'), value: format.money(analysis.estimated_cost, analysis.currency ?? project.currency) },
                    analysis.estimated_hours !== null && { label: t('analysis.hoursLabel'), value: t('analysis.hoursValue', { hours: cmFormatNumber(analysis.estimated_hours, format.language) }) },
                    analysis.complexity_score !== null && { label: t('analysis.complexityLabel'), value: analysis.complexity_score },
                  ]}
                />
                {analysis.proposal && (
                  <section className="cmm-stack-tight">
                    <MobileSectionHeader title={t('analysis.proposalTitle')} />
                    <p className="cmm-prose">{analysis.proposal}</p>
                  </section>
                )}
                {LIST_FIELDS.map((field) => {
                  const values = (analysis[field.key] ?? []) as string[];
                  return values.length > 0 ? (
                    <section key={field.key} className="cmm-stack-tight">
                      <MobileSectionHeader title={t(field.labelKey)} />
                      <MobileTagList items={values} />
                    </section>
                  ) : null;
                })}
                {analysis.revision_notes && <p className="cmm-hint">{t('analysis.revisionNotes')}: {analysis.revision_notes}</p>}
                {data?.can_accept && <p className="cmm-hint">{t('analysis.acceptHint')}</p>}
                {canRevise && <MobileButton block disabled={busy} onClick={() => setRevising(true)}>{t('analysis.requestRevision')}</MobileButton>}
              </>
            )}
          </div>
        )}
        {canConfirmBudget && (
          <div className="cmm-stack-tight">
            <p className="cmm-hint">{t('analysis.budgetFallbackHint', { amount: format.money(project.budget ?? '', project.currency) })}</p>
            <MobileButton variant="primary" block loading={busy} onClick={() => void model.confirmBudget()}>{busy ? t('common.saving') : t('analysis.confirmBudget')}</MobileButton>
          </div>
        )}
        {canAnalyze && (
          <MobileButton variant="primary" block icon={<Sparkles aria-hidden="true" />} loading={busy} onClick={() => void model.analyze()}>
            {busy ? t('analysis.starting') : (analysis?.status === CM_ANALYSIS_FAILED_STATUS ? t('analysis.retry') : t('analysis.run'))}
          </MobileButton>
        )}
      </MobileCard>

      {data?.can_accept && completed && (
        <div className="cmm-stickybar">
          <MobileButton variant="primary" loading={busy} onClick={() => setAccepting(true)}>{t('analysis.accept')}</MobileButton>
        </div>
      )}

      <MobileConfirmSheet
        open={accepting}
        title={t('analysis.accept')}
        message={`${analysis?.estimated_cost !== null && analysis?.estimated_cost !== undefined ? `${format.money(analysis.estimated_cost, analysis.currency ?? project.currency)}. ` : ''}${t('analysis.acceptHint')}`}
        confirmLabel={t('analysis.accept')}
        busy={busy}
        onClose={() => setAccepting(false)}
        onConfirm={accept}
      />
      <MobileSheet
        open={revising}
        onClose={() => setRevising(false)}
        title={t('analysis.requestRevision')}
        footer={(
          <>
            <MobileButton disabled={busy} onClick={() => setRevising(false)}>{t('common.cancel')}</MobileButton>
            <MobileButton variant="primary" loading={busy} disabled={!revisionValid} onClick={() => void sendRevision()}>{t('analysis.sendRevision')}</MobileButton>
          </>
        )}
      >
        <MobileField label={t('analysis.revisionLabelField')} error={revisionNotes !== '' && !revisionValid && t('analysis.revisionTooShort', { min: CM_ANALYSIS_REVISION_MIN_LENGTH })}>
          <textarea className="cmm-input cmm-textarea" rows={4} value={revisionNotes} onChange={(event) => model.setRevisionNotes(event.target.value)} placeholder={t('analysis.revisionPlaceholder')} />
        </MobileField>
      </MobileSheet>
    </>
  );
};
