import React, { useState } from 'react';
import { CheckCircle2, CircleDashed, Workflow } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import type { CmArchitectProject } from '../../../api/CmApiTypes';
import { CM_PROTECTED_ROUTE, cmProjectPath } from '../../../components/public-home/cmPublicRoutes';
import { cmFormatNumber, useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmPolicy } from '../../../contexts/useCmPolicy';
import { CM_ARCHITECT_METRIC_STAT_KEYS, useCmArchitect } from '../../../shared/useCmArchitect';
import { MobileButton, MobileCard, MobileErrorState, MobileList, MobileListRow, MobileScreen, MobileSectionHeader, MobileSkeletonBlock, MobileStatusBadge, useMobileFeedback, MobileConfirmSheet } from '../../ui';
import './styles/cm-mobile-work.css';

/** Mobile architect hub: eligibility, application and activation, assigned projects (plan milestones and tasks in the project) and projects to accept. */
const MobileArchitectScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const feedback = useMobileFeedback();
  const architect = useCmArchitect(feedback);
  const { eligibility, assignments, loading, loadError, pendingActivation, isArchitect, busy, acceptingId } = architect;
  const [accepting, setAccepting] = useState<CmArchitectProject | null>(null);

  const accept = async (): Promise<void> => {
    if (!accepting) return;
    await architect.acceptProject(accepting.id);
    setAccepting(null);
  };

  return (
    <MobileScreen title={isArchitect ? t('nav.architect') : t('nav.architectApply')} onRefresh={architect.load}>
      {loading && !eligibility ? (
        <MobileSkeletonBlock height={180} />
      ) : loadError || !eligibility ? (
        <MobileErrorState message={loadError ?? t('architect.loadFailed')} onRetry={architect.loadRetryable ? () => void architect.load() : undefined} />
      ) : (
        <>
          {!isArchitect && (
            <MobileCard>
              <h3 className="cmm-card-title"><Workflow aria-hidden="true" /> {t('architect.eligibilityTitle')}</h3>
              <p className="cmm-card-lead">{eligibility.is_eligible ? t('architect.eligible') : t(`architect.reasons.${eligibility.reason ?? 'requirements_unmet'}`, { defaultValue: t('architect.reasons.requirements_unmet') })}</p>
              <div>
                {Object.entries(eligibility.requirements).map(([key, required]) => {
                  const current = eligibility.current_stats[CM_ARCHITECT_METRIC_STAT_KEYS[key] ?? key.replace('min_', '')];
                  const met = typeof current === 'number' && current >= required;
                  return (
                    <div key={key} className="cmm-req" data-met={met}>
                      {met ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                      <span>{t(`architect.metrics.${key}`, { defaultValue: key })}</span>
                      <strong>{t('architect.progressValue', { current: current === undefined ? t('common.unavailable') : cmFormatNumber(current, format.language), required: cmFormatNumber(required, format.language) })}</strong>
                    </div>
                  );
                })}
              </div>
              {eligibility.is_eligible && !pendingActivation && (
                <MobileButton variant="primary" block loading={busy} onClick={() => void architect.apply()}>{busy ? t('common.saving') : t('architect.apply')}</MobileButton>
              )}
              {pendingActivation && (
                <div className="cmm-stack-tight">
                  <p className="cmm-hint">{t('architect.activationHint', { amount: format.money(eligibility.required_deposit ?? 0, currency) })}</p>
                  <MobileButton variant="primary" block loading={busy} onClick={() => void architect.completeActivation()}>{busy ? t('common.saving') : t('architect.completeActivation')}</MobileButton>
                  <MobileButton block to={CM_PROTECTED_ROUTE.wallet}>{t('funding.openWallet')}</MobileButton>
                </div>
              )}
            </MobileCard>
          )}
          {isArchitect && assignments && (
            <>
              <section className="cmm-stack-tight">
                <MobileSectionHeader title={t('architect.assignmentsTitle')} />
                {assignments.assigned_projects.length === 0 ? <p className="cmm-hint">{t('architect.noAssignments')}</p> : (
                  <MobileList label={t('architect.assignmentsTitle')}>
                    {assignments.assigned_projects.map((project) => (
                      <MobileListRow key={project.id} to={cmProjectPath(project.id)} title={project.title} subtitle={t('mobile.work.architect.planHint')} trailing={<MobileStatusBadge group="project" status={project.status} />} />
                    ))}
                  </MobileList>
                )}
              </section>
              <section className="cmm-stack-tight">
                <MobileSectionHeader title={t('architect.availableTitle')} />
                {assignments.available_projects.length === 0 ? <p className="cmm-hint">{t('architect.noAvailable')}</p> : (
                  <MobileList label={t('architect.availableTitle')}>
                    {assignments.available_projects.map((project) => (
                      <MobileListRow
                        key={project.id}
                        title={project.title}
                        subtitle={<MobileStatusBadge group="project" status={project.status} />}
                        trailing={<MobileButton small variant="primary" loading={acceptingId === project.id} disabled={acceptingId !== null} onClick={() => setAccepting(project)}>{t('architect.acceptProject')}</MobileButton>}
                      />
                    ))}
                  </MobileList>
                )}
              </section>
            </>
          )}
        </>
      )}
      <MobileConfirmSheet
        open={accepting !== null}
        title={t('architect.acceptProject')}
        message={accepting?.title ?? ''}
        confirmLabel={t('architect.acceptProject')}
        busy={acceptingId !== null}
        onClose={() => setAccepting(null)}
        onConfirm={accept}
      />
    </MobileScreen>
  );
};

export default MobileArchitectScreen;
