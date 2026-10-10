import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  Inbox,
  ListChecks,
  MessageSquareQuote,
  Monitor,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cmFormatPercent } from '../../../../components/workspace/cmWorkspaceFormat';
import { CM_ADMIN_ROUTE, cmRouteWithQuery } from '../../../../components/public-home/cmPublicRoutes';
import { useCmAdminFormat, useCmAdminOverview } from '../../../../admin/useCmAdminData';
import { setCmUiMode } from '../../../../shared/cmUiMode';
import {
  MobileButton,
  MobileCard,
  MobileChipRow,
  MobileErrorState,
  MobileList,
  MobileListRow,
  MobileNotice,
  MobileScreen,
  MobileSectionHeader,
  MobileSkeletonBlock,
  MobileStatChip,
  MobileStatusBadge,
} from '../../../ui';
import { MobileKeyValues } from '../parts/MobileKeyValues';
import { useAdminText } from './MobileAdminParts';

const QUEUE_ICONS: Record<string, LucideIcon> = {
  kyc: ShieldCheck,
  deposits: WalletCards,
  refunds: RotateCcw,
  withdrawals: Banknote,
  roles: UserCog,
  testimonials: MessageSquareQuote,
  contact: Inbox,
};

const TOTAL_ICONS: Record<string, LucideIcon> = {
  users: Users,
  roleHolders: UserCog,
  projects: BriefcaseBusiness,
  tasks: ListChecks,
  reviewersPassed: BadgeCheck,
};

/** Pages of the full web console that have no mobile screen; they open inside the app frame. */
const WEB_CONSOLE_LINKS = [
  { id: 'projects', route: CM_ADMIN_ROUTE.projects, labelKey: 'admin.nav.projects' },
  { id: 'tasks', route: CM_ADMIN_ROUTE.tasks, labelKey: 'admin.nav.tasks' },
  { id: 'testimonials', route: CM_ADMIN_ROUTE.testimonials, labelKey: 'admin.nav.testimonials' },
  { id: 'activity', route: CM_ADMIN_ROUTE.activity, labelKey: 'admin.nav.activity' },
] as const;

/** Console overview for the phone: what is waiting for a decision, platform totals, projects by status, policy and web console. */
export const MobileAdminOverviewScreen: React.FC = () => {
  const { t } = useAdminText();
  const format = useCmAdminFormat();
  const { overview, loading, error, load, openQueues, clearQueues, pendingTotal, totals, projectCounts, projectStatuses } = useCmAdminOverview();

  return (
    <MobileScreen title={t('admin.nav.overview')} onRefresh={load}>
      {loading ? (
        <><MobileSkeletonBlock height={120} /><MobileSkeletonBlock height={90} /></>
      ) : error || !overview ? (
        <MobileErrorState message={error ?? t('admin.loadFailed')} onRetry={() => void load()} />
      ) : (
        <>
          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.overview.pendingTitle')} />
            <p className="cmm-summary">{pendingTotal > 0 ? t('admin.overview.pendingSummary', { count: pendingTotal, total: format.number(pendingTotal) }) : t('admin.overview.allClear')}</p>
            {openQueues.length > 0 && (
              <div className="cmmc-queues">
                {openQueues.map((queue) => {
                  const Icon = QUEUE_ICONS[queue.id];
                  return (
                    <Link key={queue.id} to={queue.route} className="cmmc-queue">
                      <span className="cmmc-queue__icon"><Icon aria-hidden="true" /></span>
                      <strong>{format.number(queue.count)}</strong>
                      <span>{t(`admin.overview.queue.${queue.id}.title`)}</span>
                      <small>{t(`admin.overview.queue.${queue.id}.hint`)}</small>
                    </Link>
                  );
                })}
              </div>
            )}
            {clearQueues.length > 0 && (
              <MobileCard className="cmmc-clear">
                <span><CheckCircle2 aria-hidden="true" /> {t('admin.overview.noPending')}</span>
                <div>
                  {clearQueues.map((queue) => <Link key={queue.id} to={queue.route} className="cmmc-link">{t(`admin.overview.queue.${queue.id}.title`)}</Link>)}
                </div>
              </MobileCard>
            )}
          </section>

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.overview.platformTitle')} />
            <MobileChipRow label={t('admin.overview.platformTitle')}>
              {totals.map((card) => {
                const Icon = TOTAL_ICONS[card.key];
                return <MobileStatChip key={card.key} to={card.route ?? undefined} value={format.number(card.value ?? 0)} label={t(`admin.metrics.${card.key}`)} icon={<Icon aria-hidden="true" />} />;
              })}
            </MobileChipRow>
          </section>

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.overview.projectsByStatus')} />
            {projectStatuses.length === 0 ? (
              <MobileNotice>{t('admin.noProjectsAtAll')}</MobileNotice>
            ) : (
              <MobileList>
                {projectStatuses.map((status) => (
                  <MobileListRow
                    key={status}
                    to={cmRouteWithQuery(CM_ADMIN_ROUTE.projects, { status })}
                    title={<MobileStatusBadge status={status} prefix="states.project" />}
                    trailing={<strong>{format.number(projectCounts[status] ?? 0)}</strong>}
                  />
                ))}
              </MobileList>
            )}
          </section>

          <section className="cmm-section">
            <MobileSectionHeader title={t('mobile.c.admin.more')} />
            <MobileList>
              <MobileListRow to={CM_ADMIN_ROUTE.users} leading={<Users aria-hidden="true" />} title={t('admin.nav.users')} />
              <MobileListRow to={CM_ADMIN_ROUTE.payments} leading={<WalletCards aria-hidden="true" />} title={t('admin.nav.payments')} />
              <MobileListRow to={CM_ADMIN_ROUTE.reviewerApplications} leading={<BadgeCheck aria-hidden="true" />} title={t('admin.nav.reviewers')} />
              <MobileListRow to={CM_ADMIN_ROUTE.policy} leading={<ListChecks aria-hidden="true" />} title={t('admin.policy.title')} />
              {WEB_CONSOLE_LINKS.map((link) => <MobileListRow key={link.id} to={link.route} leading={<Monitor aria-hidden="true" />} title={t(link.labelKey)} subtitle={t('mobile.c.admin.webPage')} />)}
            </MobileList>
          </section>
        </>
      )}
    </MobileScreen>
  );
};

/** Read-only view of the platform rules; editing opens the full web console. */
export const MobileAdminPolicyScreen: React.FC = () => {
  const { t, money } = useAdminText();
  const format = useCmAdminFormat();
  const navigate = useNavigate();
  const { policy, loading, error, load } = useCmAdminOverview();

  const thresholdRows = policy ? [
    ...Object.entries(policy.architect_thresholds ?? {}).map(([key, value]) => ({ key: `architect.${key}`, value })),
    ...Object.entries(policy.reviewer_thresholds ?? {}).map(([key, value]) => ({ key: `reviewer.${key}`, value })),
  ] : [];

  const openWebConsole = (): void => {
    setCmUiMode('web');
    navigate(CM_ADMIN_ROUTE.policy);
  };

  return (
    <MobileScreen title={t('admin.policy.title')} onRefresh={load}>
      {loading ? (
        <><MobileSkeletonBlock height={140} /><MobileSkeletonBlock height={140} /></>
      ) : error || !policy ? (
        <MobileErrorState message={error ?? t('admin.loadFailed')} onRetry={() => void load()} />
      ) : (
        <>
          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.policy.deposits')} />
            <MobileCard>
              <MobileKeyValues
                items={[
                  ...Object.entries(policy.deposit_amounts ?? {}).map(([role, amount]) => ({ label: t(`roles.${role}`, { defaultValue: role }), value: money(amount, policy.currency) })),
                  { label: t('admin.policy.architectAdditional'), value: money(policy.architect_additional_deposit, policy.currency) },
                  { label: t('admin.policy.commission'), value: cmFormatPercent(policy.platform_commission_rate, format.language) },
                  policy.wallet_top_up ? { label: t('admin.policy.walletTopUp'), value: `${money(policy.wallet_top_up.min_amount, policy.currency)} – ${money(policy.wallet_top_up.max_amount, policy.currency)}` } : null,
                ]}
              />
            </MobileCard>
          </section>
          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.policy.thresholds')} />
            <MobileCard>
              <MobileKeyValues
                items={[
                  ...thresholdRows.map((row) => ({
                    label: t(`admin.policy.threshold.${row.key}`, { defaultValue: row.key }),
                    value: t(`admin.policy.thresholdValue.${row.key}`, { value: row.value, defaultValue: String(row.value) }),
                  })),
                  { label: t('admin.policy.maxKycImage'), value: t('admin.policy.sizeKb', { size: format.number(policy.max_kyc_image_size_kb) }) },
                  { label: t('admin.policy.maxAttachment'), value: t('admin.policy.sizeKb', { size: format.number(policy.max_attachment_size_kb) }) },
                ]}
              />
            </MobileCard>
          </section>
          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.policy.roleTransitions')} />
            <MobileCard>
              <MobileKeyValues
                items={[
                  ...Object.entries(policy.role_status_transitions ?? {}).map(([from, targets]) => ({
                    label: t(`states.role.${from}`, { defaultValue: from }),
                    value: targets.length === 0 ? t('common.unavailable') : targets.map((target) => t(`states.role.${target}`, { defaultValue: target })).join(' / '),
                  })),
                  { label: t('admin.policy.reasonRequired'), value: (policy.role_status_reason_required ?? []).map((status) => t(`states.role.${status}`, { defaultValue: status })).join(' / ') },
                  { label: t('admin.policy.projectTargets'), value: (policy.admin_project_target_statuses ?? []).map((status) => t(`states.project.${status}`, { defaultValue: status })).join(' / ') },
                ]}
              />
            </MobileCard>
          </section>
          <MobileNotice>{t('mobile.c.admin.policyEditHint')}</MobileNotice>
          <MobileButton block icon={<ArrowRight aria-hidden="true" />} onClick={openWebConsole}>{t('mobile.c.admin.openWebConsole')}</MobileButton>
        </>
      )}
    </MobileScreen>
  );
};
