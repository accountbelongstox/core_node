import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, MailCheck, Plus } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../../../../api/cmErrors';
import { cmAdminApi } from '../../../../admin/CmAdminApi';
import type { CmAdminUserDetail } from '../../../../admin/CmAdminTypes';
import { useCmAdminList, useCmAdminParam } from '../../../../admin/useCmAdminData';
import { CM_ADMIN_ROUTE, cmAdminUserPath } from '../../../../components/public-home/cmPublicRoutes';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { MobileButton, MobileCard, MobileErrorState, MobileField, MobileList, MobileListRow, MobileListState, MobilePager, MobileScreen, MobileSectionHeader, MobileSheet, MobileSkeletonList, MobileStatusBadge, MobileKeyValues } from '../../../ui';
import { AdminRecord, AdminRecordList, AdminSearch, AdminStatusFilter, AdminUserLink, useAdminText, useMobileAdminActions } from './MobileAdminParts';

const SCORE_FRACTION_DIGITS = 1;

/** Accounts of the platform with their roles; opens the account detail where role status changes are made. */
export const MobileAdminUsersScreen: React.FC = () => {
  const { t } = useAdminText();
  const { roles, states } = useCmBootstrap();
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [role, setRole] = useState(useCmAdminParam('role'));
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ search, role, status }), [search, role, status]);
  const list = useCmAdminList((query) => cmAdminApi.users(query), filters);

  return (
    <MobileScreen title={t('admin.nav.users')} onRefresh={list.reload}>
      <AdminSearch value={search} onApply={setSearch} placeholder={t('admin.searchUsersPlaceholder')} />
      <AdminStatusFilter ariaLabel={t('admin.filterRole')} value={role} onChange={setRole} options={roles} optionLabel={(option) => t(`roles.${option}`)} allLabel={t('admin.allRoles')} />
      <AdminStatusFilter ariaLabel={t('admin.filterRoleStatus')} value={status} onChange={setStatus} options={states('role')} optionLabel={(option) => t(`states.role.${option}`)} />
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={t('admin.noUsers')}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <MobileList label={t('admin.nav.users')}>
          {list.items.map((user) => (
            <MobileListRow
              key={user.id}
              to={cmAdminUserPath(user.id)}
              title={<>{user.username}{user.is_admin && <span className="cmm-badge" data-tone="info">{t('admin.adminFlag')}</span>}</>}
              subtitle={[user.name, user.email].filter(Boolean).join(' · ') || undefined}
              meta={Object.keys(user.roles).length === 0
                ? t('admin.noRole')
                : Object.entries(user.roles).map(([roleType, roleStatus]) => t('admin.roleWithStatus', {
                  role: t(`roles.${roleType}`, { defaultValue: roleType }),
                  status: t(`states.role.${roleStatus}`, { defaultValue: roleStatus }),
                })).join(' · ')}
            />
          ))}
        </MobileList>
      </MobileListState>
      <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </MobileScreen>
  );
};

/** One account: profile, wallet, role statuses with the transitions the server allows, grant role, KYC and deposits. */
export const MobileAdminUserDetailScreen: React.FC = () => {
  const { t, money, dateTime, date } = useAdminText();
  const { userId } = useParams();
  const { roles, stateRule } = useCmBootstrap();
  const numericId = Number(userId);
  const [detail, setDetail] = useState<CmAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantRole, setGrantRole] = useState('');
  const [grantStatusChoice, setGrantStatusChoice] = useState('');
  const grantStatuses = stateRule('role_admin_grantable');
  const grantStatus = grantStatuses.includes(grantStatusChoice) ? grantStatusChoice : grantStatuses[0] ?? '';

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError(t('errors.user_not_found'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const response = await cmAdminApi.userDetail(numericId);
    if (response.success && response.data) {
      setDetail(response.data);
    } else {
      setDetail(null);
      setError(cmErrorMessage(t, response, 'admin.loadFailed'));
    }
    setLoading(false);
  }, [numericId, t]);

  const actions = useMobileAdminActions(load);

  useEffect(() => {
    void load();
  }, [load]);

  const account = detail?.account;
  const heldRoles = new Set((detail?.roles ?? []).map((role) => role.role_type));
  const grantableRoles = roles.filter((role) => !heldRoles.has(role));

  const grant = (): void => {
    if (!grantRole) return;
    setGrantOpen(false);
    actions.grantRole(numericId, account?.username, grantRole, grantStatus, () => setGrantRole(''));
  };

  return (
    <MobileScreen title={account?.username ?? t('admin.userDetail.title')} onRefresh={load}>
      {loading ? (
        <MobileSkeletonList rows={4} />
      ) : error || !detail || !account ? (
        <MobileErrorState message={error ?? t('admin.loadFailed')} onRetry={() => void load()} />
      ) : (
        <>
          <MobileCard>
            <MobileKeyValues
              items={[
                { label: t('admin.userDetail.name'), value: account.name ?? account.nickname ?? t('common.unavailable') },
                { label: t('admin.columnEmail'), value: account.email ?? t('common.unavailable') },
                { label: t('admin.userDetail.userId'), value: account.id },
                { label: t('admin.userDetail.administrator'), value: t(account.is_admin ? 'admin.yes' : 'admin.no') },
                { label: t('admin.userDetail.emailVerified'), value: t(account.email_verified ? 'admin.yes' : 'admin.no') },
                { label: t('admin.userDetail.phoneVerified'), value: t(account.phone_verified ? 'admin.yes' : 'admin.no') },
                { label: t('admin.columnCreated'), value: date(account.created_at) },
              ]}
            />
          </MobileCard>

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.userDetail.wallet')} />
            <MobileCard>
              <MobileKeyValues
                items={[
                  { label: t('admin.userDetail.balance'), value: money(detail.wallet.balance, detail.wallet.currency) },
                  { label: t('admin.userDetail.available'), value: money(detail.wallet.available_balance, detail.wallet.currency) },
                  { label: t('admin.userDetail.frozen'), value: money(detail.wallet.frozen_balance, detail.wallet.currency) },
                ]}
              />
            </MobileCard>
          </section>

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.userDetail.roles')} actionLabel={grantableRoles.length > 0 ? t('admin.userDetail.grantRole') : undefined} onAction={() => setGrantOpen(true)} />
            {detail.roles.length === 0 ? (
              <p className="cmm-muted">{t('admin.userDetail.noRoles')}</p>
            ) : (
              <div className="cmmc-records">
                {detail.roles.map((role) => (
                  <AdminRecord
                    key={role.id}
                    title={t(`roles.${role.role_type}`, { defaultValue: role.role_type })}
                    badge={<MobileStatusBadge status={role.role_status} prefix="states.role" />}
                    facts={[
                      { label: t('admin.userDetail.deposit'), value: money(role.deposit_amount, detail.wallet.currency) },
                      { label: t('admin.userDetail.activatedAt'), value: dateTime(role.role_activated_at) },
                    ]}
                    actions={role.allowed_transitions.length === 0 ? undefined : role.allowed_transitions.map((target) => (
                      <MobileButton
                        key={target}
                        variant={actions.reasonRequiredRoleStates.includes(target) ? 'danger' : 'primary'}
                        onClick={() => actions.changeRoleStatus(numericId, account.username, role, target)}
                      >
                        {t(`admin.userDetail.transition.${target}`, { defaultValue: target })}
                      </MobileButton>
                    ))}
                  />
                ))}
              </div>
            )}
          </section>

          {(detail.profiles.developer || detail.profiles.client) && (
            <section className="cmm-section">
              <MobileSectionHeader title={t('admin.userDetail.profiles')} />
              {detail.profiles.developer && (
                <MobileCard>
                  <h3 className="cmmc-card__title">{t('roles.developer')}</h3>
                  <MobileKeyValues
                    items={[
                      { label: t('admin.userDetail.company'), value: detail.profiles.developer.company_name ?? t('common.unavailable') },
                      { label: t('admin.userDetail.skills'), value: Array.isArray(detail.profiles.developer.skills) ? detail.profiles.developer.skills.join(', ') : detail.profiles.developer.skills ?? t('common.unavailable') },
                      { label: t('admin.userDetail.completedProjects'), value: detail.profiles.developer.completed_projects },
                      { label: t('admin.userDetail.averageRating'), value: detail.profiles.developer.average_rating },
                      { label: t('admin.userDetail.bio'), value: detail.profiles.developer.bio ?? t('common.unavailable') },
                    ]}
                  />
                </MobileCard>
              )}
              {detail.profiles.client && (
                <MobileCard>
                  <h3 className="cmmc-card__title">{t('roles.client')}</h3>
                  <MobileKeyValues
                    items={[
                      { label: t('admin.userDetail.company'), value: detail.profiles.client.company_name ?? t('common.unavailable') },
                      { label: t('admin.userDetail.industry'), value: detail.profiles.client.industry ?? t('common.unavailable') },
                      { label: t('admin.userDetail.contactPerson'), value: detail.profiles.client.contact_person ?? t('common.unavailable') },
                      { label: t('admin.userDetail.contactPhone'), value: detail.profiles.client.contact_phone ?? t('common.unavailable') },
                      { label: t('admin.userDetail.website'), value: detail.profiles.client.company_website ?? t('common.unavailable') },
                      { label: t('admin.userDetail.postedProjects'), value: detail.profiles.client.posted_projects },
                    ]}
                  />
                </MobileCard>
              )}
            </section>
          )}

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.userDetail.kyc')} actionLabel={t('admin.userDetail.reviewKyc')} actionTo={CM_ADMIN_ROUTE.kyc} />
            {detail.kyc.length === 0 ? (
              <p className="cmm-muted">{t('admin.userDetail.noKyc')}</p>
            ) : (
              <MobileList>
                {detail.kyc.map((item) => (
                  <MobileListRow
                    key={item.id}
                    to={`${CM_ADMIN_ROUTE.kyc}?status=${item.verification_status}&search=${encodeURIComponent(account.username)}`}
                    title={item.real_name}
                    subtitle={`${t(`admin.kyc.identity.${item.identity_type}`, { defaultValue: item.identity_type })} · ${dateTime(item.submitted_at)}`}
                    trailing={<MobileStatusBadge status={item.verification_status} prefix="states.kyc" />}
                  />
                ))}
              </MobileList>
            )}
          </section>

          <section className="cmm-section">
            <MobileSectionHeader title={t('admin.userDetail.deposits')} />
            {detail.deposits.length === 0 ? (
              <p className="cmm-muted">{t('admin.userDetail.noDeposits')}</p>
            ) : (
              <MobileList>
                {detail.deposits.map((deposit) => (
                  <MobileListRow
                    key={deposit.id}
                    title={t(`roles.${deposit.role_type}`, { defaultValue: deposit.role_type })}
                    subtitle={`${t(`admin.method.${deposit.payment_method}`, { defaultValue: deposit.payment_method })} · ${dateTime(deposit.created_at)}`}
                    trailing={<span className="cmmc-trail"><strong>{money(deposit.amount, detail.wallet.currency)}</strong><MobileStatusBadge status={deposit.status} prefix="admin.states.deposit" /></span>}
                  />
                ))}
              </MobileList>
            )}
          </section>

          <Link className="cmm-link-btn" to={CM_ADMIN_ROUTE.users}>{t('admin.userDetail.back')}</Link>
        </>
      )}

      <MobileSheet
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title={t('admin.userDetail.grantRole')}
        footer={<MobileButton variant="primary" block icon={<Plus aria-hidden="true" />} disabled={!grantRole} onClick={grant}>{t('admin.userDetail.grant')}</MobileButton>}
      >
        <div className="cmmc-form">
          <MobileField label={t('admin.userDetail.grantRole')}>
            <select className="cmm-input" value={grantRole} onChange={(event) => setGrantRole(event.target.value)}>
              <option value="">{t('admin.userDetail.chooseRole')}</option>
              {grantableRoles.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
            </select>
          </MobileField>
          <MobileField label={t('admin.userDetail.initialStatus')}>
            <select className="cmm-input" value={grantStatus} onChange={(event) => setGrantStatusChoice(event.target.value)}>
              {grantStatuses.map((status) => <option key={status} value={status}>{t(`states.role.${status}`)}</option>)}
            </select>
          </MobileField>
        </div>
      </MobileSheet>
      {actions.sheet}
    </MobileScreen>
  );
};

/** Reviewer applications with their exam score and role status; a passed reviewer can be revoked with a reason. */
export const MobileAdminReviewerApplicationsScreen: React.FC = () => {
  const { t, dateTime } = useAdminText();
  const { i18n } = useTranslation('cm');
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.reviewerApplications(query), filters);
  const actions = useMobileAdminActions(list.reload);

  const score = (value: string | null): string => {
    const parsed = value === null ? Number.NaN : Number(value);
    return Number.isFinite(parsed)
      ? t('admin.reviewers.scoreValue', { score: new Intl.NumberFormat(i18n.language || 'en', { maximumFractionDigits: SCORE_FRACTION_DIGITS }).format(parsed) })
      : t('common.unavailable');
  };

  return (
    <MobileScreen title={t('admin.nav.reviewers')} onRefresh={list.reload}>
      <AdminSearch value={search} onApply={setSearch} placeholder={t('admin.searchUsersPlaceholder')} />
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('reviewer_application')} optionLabel={(option) => t(`admin.states.reviewer.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noReviewerApplications"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${score(item.score)}`}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.reviewer" />}
            facts={[
              { label: t('admin.columnUser'), value: <AdminUserLink user={item.user} userId={item.user_id} /> },
              { label: t('admin.reviewers.roleStatus'), value: item.reviewer_role_status ? <MobileStatusBadge status={item.reviewer_role_status} prefix="states.role" /> : t('admin.noRole') },
              { label: t('admin.reviewers.completedAt'), value: dateTime(item.completed_at) },
              item.revoke_reason ? { label: t('admin.reviewers.revokeReason'), value: item.revoke_reason } : null,
            ]}
            actions={item.revocable ? <MobileButton variant="danger" icon={<Ban aria-hidden="true" />} onClick={() => actions.revokeReviewer(item)}>{t('admin.reviewers.revoke')}</MobileButton> : undefined}
          />
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};

/** Contact messages from the public form: reply by mail, mark as handled. */
export const MobileAdminContactMessagesScreen: React.FC = () => {
  const { t, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'new'));
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.contactMessages(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <MobileScreen title={t('admin.nav.contact')} onRefresh={list.reload}>
      <AdminSearch value={search} onApply={setSearch} placeholder={t('admin.contact.search')} />
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('contact_message')} optionLabel={(option) => t(`admin.states.contact.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noContactMessages"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={item.subject || t('admin.contact.noSubject')}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.contact" />}
            facts={[
              { label: t('admin.contact.from'), value: item.name },
              { label: t('admin.columnEmail'), value: <a className="cmmc-link" href={`mailto:${item.email}`}>{item.email}</a> },
              { label: t('admin.contact.receivedAt'), value: dateTime(item.created_at) },
              item.handled_at ? { label: t('admin.contact.handledAt'), value: dateTime(item.handled_at) } : null,
            ]}
            note={item.message}
            actions={(
              <>
                <a className="cmm-btn is-secondary" href={`mailto:${item.email}?subject=${encodeURIComponent(t('admin.contact.replySubject', { subject: item.subject || t('admin.contact.noSubject') }))}`}><span>{t('admin.contact.reply')}</span></a>
                {item.status === 'new' && <MobileButton variant="primary" icon={<MailCheck aria-hidden="true" />} onClick={() => actions.handleContact(item)}>{t('admin.contact.handle')}</MobileButton>}
              </>
            )}
          />
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};
