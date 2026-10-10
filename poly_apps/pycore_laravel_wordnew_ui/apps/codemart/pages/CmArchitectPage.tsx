import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDashed, RefreshCw, Workflow } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmArchitectProject } from '../api/CmApiTypes';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { CM_PROTECTED_ROUTE, cmProjectPath } from '../components/public-home/cmPublicRoutes';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmFormatNumber, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { CM_ARCHITECT_METRIC_STAT_KEYS, useCmArchitect } from '../shared/useCmArchitect';

const CmArchitectProjectList: React.FC<{
  titleKey: string;
  emptyKey: string;
  projects: CmArchitectProject[];
  renderAction: (project: CmArchitectProject) => React.ReactNode;
}> = ({ titleKey, emptyKey, projects, renderAction }) => {
  const { t } = useTranslation('cm');
  return (
    <section className="cm-section-card">
      <h2>{t(titleKey)}</h2>
      {projects.length === 0 ? (
        <p className="cm-field-hint">{t(emptyKey)}</p>
      ) : (
        <ul className="cm-preview-list">
          {projects.map((project) => (
            <li key={project.id} className="cm-preview-list__row">
              <span className="cm-preview-list__title">{project.title}</span>
              <CmStatusBadge group="project" status={project.status} />
              {renderAction(project)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const CmArchitectPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const notice = useCmNotice();
  const architect = useCmArchitect(notice);
  const { eligibility, assignments, loading, loadError, pendingActivation, isArchitect, busy, acceptingId, load } = architect;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="architect.eyebrow"
        titleKey={isArchitect ? 'nav.architect' : 'nav.architectApply'}
        purposeKey={isArchitect ? 'architect.description' : 'architect.applyPurpose'}
        actions={(
          <button type="button" className="cm-workspace-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      />
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {loading && !eligibility ? (
        <CmLoadingState />
      ) : loadError || !eligibility ? (
        <CmErrorState message={loadError ?? t('architect.loadFailed')} onRetry={architect.loadRetryable ? () => void load() : undefined} />
      ) : (
        <>
          {!isArchitect && (
            <section className="cm-section-card">
              <h2><Workflow aria-hidden="true" /> {t('architect.eligibilityTitle')}</h2>
              <p className="cm-section-card__lead">
                {eligibility.is_eligible ? t('architect.eligible') : t(`architect.reasons.${eligibility.reason ?? 'requirements_unmet'}`, { defaultValue: t('architect.reasons.requirements_unmet') })}
              </p>
              <ul className="cm-requirement-list">
                {Object.entries(eligibility.requirements).map(([key, required]) => {
                  const current = eligibility.current_stats[CM_ARCHITECT_METRIC_STAT_KEYS[key] ?? key.replace('min_', '')];
                  const met = typeof current === 'number' && current >= required;
                  return (
                    <li key={key} data-met={met}>
                      {met ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                      <span>{t(`architect.metrics.${key}`, { defaultValue: key })}</span>
                      <strong>{t('architect.progressValue', { current: current === undefined ? t('common.unavailable') : cmFormatNumber(current, format.language), required: cmFormatNumber(required, format.language) })}</strong>
                    </li>
                  );
                })}
              </ul>
              {eligibility.is_eligible && !pendingActivation && (
                <div className="cm-section-card__actions">
                  <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void architect.apply()}>
                    {busy ? t('common.saving') : t('architect.apply')}
                  </button>
                </div>
              )}
              {pendingActivation && (
                <div className="cm-confirm-box">
                  <p>{t('architect.activationHint', { amount: format.money(eligibility.required_deposit ?? 0, currency) })}</p>
                  <div className="cm-table-actions">
                    <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void architect.completeActivation()}>
                      {busy ? t('common.saving') : t('architect.completeActivation')}
                    </button>
                    <Link to={CM_PROTECTED_ROUTE.wallet} className="cm-workspace-button">{t('funding.openWallet')}</Link>
                  </div>
                </div>
              )}
            </section>
          )}
          {isArchitect && assignments && (
            <>
              <CmArchitectProjectList
                titleKey="architect.assignmentsTitle"
                emptyKey="architect.noAssignments"
                projects={assignments.assigned_projects}
                renderAction={(project) => (
                  <Link to={cmProjectPath(project.id)} className="cm-workspace-button is-small">
                    {t('projects.openDetail')} <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              />
              <CmArchitectProjectList
                titleKey="architect.availableTitle"
                emptyKey="architect.noAvailable"
                projects={assignments.available_projects}
                renderAction={(project) => (
                  <button
                    type="button"
                    className="cm-workspace-button is-small is-primary"
                    disabled={acceptingId !== null}
                    onClick={() => void architect.acceptProject(project.id)}
                  >
                    {acceptingId === project.id ? t('common.saving') : t('architect.acceptProject')}
                  </button>
                )}
              />
            </>
          )}
        </>
      )}
    </main>
  );
};

export default CmArchitectPage;
