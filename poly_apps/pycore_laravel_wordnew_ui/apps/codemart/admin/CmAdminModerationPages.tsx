import React, { useMemo, useState } from 'react';
import { Ban, Check, EyeOff, MailCheck, Save, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmAdminApi } from './CmAdminApi';
import {
  CmAdminActivityTable,
  CmAdminDate,
  CmAdminListState,
  CmAdminNotice,
  CmAdminPageHeader,
  CmAdminPager,
  CmAdminSearch,
  CmAdminSelect,
  CmAdminStatus,
  CmAdminTable,
  CmAdminToolbar,
  CmAdminUserLink,
  cmAdminHumanize,
  useCmAdminAction,
  useCmAdminFormat,
  useCmAdminList,
  useCmAdminParam,
} from './CmAdminShared';
import {
  CM_ADMIN_ACTIVITY_ACTIONS,
  CM_ADMIN_ACTIVITY_RESOURCES,
  CM_ADMIN_CONTACT_STATUSES,
  CM_ADMIN_REVIEWER_STATUSES,
  CM_ADMIN_TESTIMONIAL_LOCALES,
  CM_ADMIN_TESTIMONIAL_STATUSES,
  type CmAdminContactMessageRow,
  type CmAdminReviewerApplicationRow,
  type CmAdminTestimonialRow,
} from './CmAdminTypes';

const SCORE_FRACTION_DIGITS = 1;

export const CmAdminTestimonialsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState('');
  const [sortDrafts, setSortDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.testimonials(query), filters);
  const action = useCmAdminAction(list.reload);

  const authorOf = (item: CmAdminTestimonialRow): string => item.author_label || item.user?.username || t('admin.testimonials.anonymous');
  const roleOf = (item: CmAdminTestimonialRow): string | null => item.role_labels?.[format.language] ?? item.role_label;

  const moderate = (item: CmAdminTestimonialRow, approve: boolean): void => action.ask({
    title: t(approve ? 'admin.testimonials.approveTitle' : 'admin.testimonials.hideTitle', { author: authorOf(item) }),
    body: t(approve ? 'admin.testimonials.approveBody' : 'admin.testimonials.hideBody'),
    confirmLabel: t(approve ? 'admin.testimonials.publish' : 'admin.testimonials.hide'),
    tone: approve ? 'primary' : 'danger',
    successKey: approve ? 'admin.testimonials.approved' : 'admin.testimonials.hidden',
    run: () => (approve ? cmAdminApi.approveTestimonial(item.id) : cmAdminApi.hideTestimonial(item.id)),
  });

  const saveOrder = async (item: CmAdminTestimonialRow): Promise<void> => {
    const draft = sortDrafts[item.id];
    const sortOrder = Number(draft);
    if (draft === undefined || draft.trim() === '' || !Number.isInteger(sortOrder) || sortOrder < 0) {
      action.setNotice({ tone: 'error', text: t('admin.testimonials.sortInvalid') });
      return;
    }
    setSavingId(item.id);
    const response = await cmAdminApi.updateTestimonial(item.id, { sort_order: sortOrder });
    setSavingId(null);
    if (response.success) {
      action.setNotice({ tone: 'success', text: t('admin.testimonials.sortSaved') });
      setSortDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await list.reload();
    } else {
      action.setNotice({ tone: 'error', text: cmErrorMessage(t, response, 'admin.actionFailed') });
    }
  };

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.testimonials" purposeKey="admin.purpose.testimonials" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.testimonials.search" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_TESTIMONIAL_STATUSES}
          optionLabel={(option) => t(`admin.states.testimonial.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noTestimonials" onRetry={() => void list.reload()}>
        <section className="cm-card-list">
          {list.items.map((item) => (
            <article key={item.id} className="cm-record-card cm-admin-record">
              <div className="cm-record-card__main">
                <div className="cm-admin-record__title">
                  <h2>{authorOf(item)}{roleOf(item) ? <small> · {roleOf(item)}</small> : null}</h2>
                  <CmAdminStatus status={item.status} group="admin.states.testimonial" />
                </div>
                <div className="cm-admin-quotes">
                  {CM_ADMIN_TESTIMONIAL_LOCALES.map((locale) => (
                    <blockquote key={locale}>
                      <small>{t(`admin.testimonials.locale.${locale}`)}</small>
                      <span>{item.quotes?.[locale] ?? (item.quote_key ? t(item.quote_key, { defaultValue: item.quote_key }) : t('admin.testimonials.noQuote'))}</span>
                    </blockquote>
                  ))}
                </div>
                <dl className="cm-admin-facts">
                  {item.user_id && <div><dt>{t('admin.testimonials.submittedBy')}</dt><dd><CmAdminUserLink user={item.user} userId={item.user_id} /></dd></div>}
                  {item.project_id && <div><dt>{t('admin.columnProject')}</dt><dd>{t('admin.projectNumber', { id: item.project_id })}</dd></div>}
                  <div><dt>{t('admin.columnCreated')}</dt><dd><CmAdminDate value={item.created_at} /></dd></div>
                  {item.moderated_at && <div><dt>{t('admin.testimonials.moderatedAt')}</dt><dd><CmAdminDate value={item.moderated_at} /></dd></div>}
                </dl>
                <div className="cm-admin-inline-form">
                  <label>
                    <span>{t('admin.testimonials.sortOrder')}</span>
                    <input
                      type="number"
                      min={0}
                      value={sortDrafts[item.id] ?? String(item.sort_order)}
                      onChange={(event) => setSortDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="cm-workspace-button"
                    disabled={savingId === item.id || sortDrafts[item.id] === undefined}
                    onClick={() => void saveOrder(item)}
                  >
                    <Save aria-hidden="true" /> {t('admin.testimonials.saveOrder')}
                  </button>
                  <small className="cm-admin-muted">{t('admin.testimonials.sortHint')}</small>
                </div>
              </div>
              <div className="cm-record-card__actions">
                {item.status !== 'approved' && (
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => moderate(item, true)}>
                    <Check aria-hidden="true" /> {t('admin.testimonials.publish')}
                  </button>
                )}
                {item.status !== 'hidden' && (
                  <button type="button" className="cm-workspace-button is-danger" onClick={() => moderate(item, false)}>
                    <EyeOff aria-hidden="true" /> {t('admin.testimonials.hide')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

export const CmAdminReviewerApplicationsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.reviewerApplications(query), filters);
  const action = useCmAdminAction(list.reload);

  const revoke = (item: CmAdminReviewerApplicationRow): void => action.ask({
    title: t('admin.reviewers.revokeTitle', { user: item.user?.username ?? t('admin.userNumber', { id: item.user_id }) }),
    body: t('admin.reviewers.revokeBody'),
    confirmLabel: t('admin.reviewers.revoke'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.reviewers.revoked',
    run: (reason) => cmAdminApi.revokeReviewer(item.id, reason),
  });

  const score = (value: string | null): string => {
    const parsed = value === null ? Number.NaN : Number(value);
    return Number.isFinite(parsed)
      ? t('admin.reviewers.scoreValue', {
        score: new Intl.NumberFormat(format.language, { maximumFractionDigits: SCORE_FRACTION_DIGITS }).format(parsed),
      })
      : t('common.unavailable');
  };

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.reviewers" purposeKey="admin.purpose.reviewers" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchUsers" placeholderKey="admin.searchUsersPlaceholder" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_REVIEWER_STATUSES}
          optionLabel={(option) => t(`admin.states.reviewer.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noReviewerApplications" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.reviewers')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.reviewers.score')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.reviewers.roleStatus')}</th>
              <th>{t('admin.reviewers.completedAt')}</th>
              <th>{t('admin.reviewers.revokeReason')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td><CmAdminUserLink user={item.user} userId={item.user_id} /></td>
                <td>{score(item.score)}</td>
                <td><CmAdminStatus status={item.status} group="admin.states.reviewer" /></td>
                <td>{item.reviewer_role_status ? <CmAdminStatus status={item.reviewer_role_status} group="states.role" /> : t('admin.noRole')}</td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.completed_at} stacked /></td>
                <td className="cm-admin-wide">{item.revoke_reason ?? t('common.unavailable')}</td>
                <td>
                  {item.revocable ? (
                    <button type="button" className="cm-workspace-button is-danger" onClick={() => revoke(item)}>
                      <Ban aria-hidden="true" /> {t('admin.reviewers.revoke')}
                    </button>
                  ) : <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

export const CmAdminContactMessagesPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [status, setStatus] = useState(useCmAdminParam('status', 'new'));
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.contactMessages(query), filters);
  const action = useCmAdminAction(list.reload);

  const handle = (item: CmAdminContactMessageRow): void => action.ask({
    title: t('admin.contact.handleTitle', { name: item.name }),
    body: t('admin.contact.handleBody', { email: item.email }),
    confirmLabel: t('admin.contact.handle'),
    successKey: 'admin.contact.handled',
    run: () => cmAdminApi.handleContactMessage(item.id),
  });

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.contact" purposeKey="admin.purpose.contact" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.contact.search" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_CONTACT_STATUSES}
          optionLabel={(option) => t(`admin.states.contact.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noContactMessages" onRetry={() => void list.reload()}>
        <section className="cm-card-list">
          {list.items.map((item) => (
            <article key={item.id} className="cm-record-card cm-admin-record">
              <div className="cm-record-card__main">
                <div className="cm-admin-record__title">
                  <h2>{item.subject || t('admin.contact.noSubject')}</h2>
                  <CmAdminStatus status={item.status} group="admin.states.contact" />
                </div>
                <dl className="cm-admin-facts">
                  <div><dt>{t('admin.contact.from')}</dt><dd>{item.name}</dd></div>
                  <div><dt>{t('admin.columnEmail')}</dt><dd><a className="cm-workspace-link" href={`mailto:${item.email}`}>{item.email}</a></dd></div>
                  <div><dt>{t('admin.contact.receivedAt')}</dt><dd><CmAdminDate value={item.created_at} /></dd></div>
                  {item.handled_at && <div><dt>{t('admin.contact.handledAt')}</dt><dd><CmAdminDate value={item.handled_at} /></dd></div>}
                </dl>
                <p className="cm-admin-message">{item.message}</p>
              </div>
              <div className="cm-record-card__actions">
                <a
                  className="cm-workspace-button"
                  href={`mailto:${item.email}?subject=${encodeURIComponent(t('admin.contact.replySubject', { subject: item.subject || t('admin.contact.noSubject') }))}`}
                >
                  {t('admin.contact.reply')}
                </a>
                {item.status === 'new' && (
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => handle(item)}>
                    <MailCheck aria-hidden="true" /> {t('admin.contact.handle')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

export const CmAdminActivityPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [resourceType, setResourceType] = useState(useCmAdminParam('resource_type'));
  const [resourceId, setResourceId] = useState(useCmAdminParam('resource_id'));
  const [actorId, setActorId] = useState(useCmAdminParam('actor_id'));
  const [actionName, setActionName] = useState(useCmAdminParam('action'));
  const filters = useMemo(() => ({
    resource_type: resourceType,
    resource_id: resourceId,
    actor_id: actorId,
    action: actionName,
  }), [resourceType, resourceId, actorId, actionName]);
  const list = useCmAdminList((query) => cmAdminApi.activity(query), filters);
  const filtered = Boolean(resourceType || resourceId || actorId || actionName);

  const clear = (): void => {
    setResourceType('');
    setResourceId('');
    setActorId('');
    setActionName('');
  };

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.activity" purposeKey="admin.purpose.activity" onRefresh={() => void list.reload()} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.activity.resourceType"
          value={resourceType}
          onChange={setResourceType}
          options={CM_ADMIN_ACTIVITY_RESOURCES}
          optionLabel={(option) => t(`admin.activity.resources.${option}`, { defaultValue: cmAdminHumanize(option) })}
          allKey="admin.allTypes"
        />
        <CmAdminSearch labelKey="admin.activity.resourceId" value={resourceId} onApply={setResourceId} icon={false} inputMode="numeric" />
        <CmAdminSelect
          labelKey="admin.activity.action"
          value={actionName}
          onChange={setActionName}
          options={CM_ADMIN_ACTIVITY_ACTIONS}
          optionLabel={(option) => t(`admin.activity.actions.${option}`, { defaultValue: cmAdminHumanize(option) })}
          allKey="admin.activity.allActions"
        />
        <CmAdminSearch labelKey="admin.activity.actorId" value={actorId} onApply={setActorId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      {filtered && (
        <p className="cm-admin-filter-note">
          <span>{t('admin.activity.filtered')}</span>
          <button type="button" className="cm-workspace-button" onClick={clear}>
            <X aria-hidden="true" /> {t('admin.clearFilters')}
          </button>
        </p>
      )}
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noActivity" onRetry={() => void list.reload()}>
        <CmAdminActivityTable
          rows={list.items}
          onResource={(type, id) => {
            setResourceType(type);
            setResourceId(String(id));
            setActorId('');
            setActionName('');
          }}
        />
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
    </main>
  );
};

