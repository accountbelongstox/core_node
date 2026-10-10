import React from 'react';
import { Building2, Code2, Save, UserRound } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { CM_BIO_MAX_LENGTH, CM_CLIENT_FIELDS, CM_NAME_MAX_LENGTH, CM_WEBSITE_FIELD, useCmProfile } from '../shared/useCmProfile';

export const CmProfilePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const form = useCmProfile(notice);
  const { profile, loading, loadError, loadRetryable, saving, heldRoles, hasDeveloperProfile, hasClientProfile, websiteInvalid, nameInvalid, client } = form;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader eyebrowKey="profile.eyebrow" titleKey="nav.profile" purposeKey="profile.description" />
      {loading && !profile ? (
        <CmLoadingState />
      ) : loadError || !profile ? (
        <CmErrorState message={loadError ?? t('profile.loadFailed')} onRetry={loadRetryable ? () => void form.reload() : undefined} />
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void form.save(); }} noValidate>
          <section className="cm-section-card">
            <h2><UserRound aria-hidden="true" /> {t('profile.accountTitle')}</h2>
            <dl className="cm-kv">
              <div><dt>{t('profile.username')}</dt><dd>{profile.user.username}</dd></div>
              <div><dt>{t('profile.email')}</dt><dd>{profile.user.email ?? t('common.unavailable')}</dd></div>
              <div>
                <dt>{t('profile.rolesTitle')}</dt>
                <dd className="cm-role-chips is-inline">
                  {heldRoles.length === 0 && t('profile.noRoles')}
                  {Object.entries(profile.roles).map(([role, status]) => (
                    <span key={role} className="cm-role-chip">{t(`roles.${role}`, { defaultValue: role })} <CmStatusBadge group="role" status={status} /></span>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="cm-project-form cm-project-form--follow">
              <label>
                <span>{t('profile.name')}</span>
                <input value={form.name} maxLength={CM_NAME_MAX_LENGTH} autoComplete="name" onChange={(event) => form.setName(event.target.value)} aria-invalid={nameInvalid} />
                {nameInvalid ? <small className="cm-field-error">{t('profile.nameRequired')}</small> : <small className="cm-field-hint">{t('profile.nameHint')}</small>}
              </label>
              <label>
                <span>{t('profile.nickname')} <small className="cm-field-hint">{t('common.optional')}</small></span>
                <input value={form.nickname} maxLength={CM_NAME_MAX_LENGTH} autoComplete="nickname" onChange={(event) => form.setNickname(event.target.value)} />
              </label>
            </div>
          </section>
          {hasDeveloperProfile && (
            <section className="cm-section-card">
              <h2><Code2 aria-hidden="true" /> {t('profile.developerTitle')}</h2>
              <p className="cm-section-card__lead">{t('profile.developerLead')}</p>
              {profile.developer && (
                <dl className="cm-kv">
                  <div><dt>{t('profile.completedProjects')}</dt><dd>{format.number(profile.developer.completed_projects)}</dd></div>
                  <div><dt>{t('profile.averageRating')}</dt><dd>{t('profile.ratingValue', { rating: profile.developer.average_rating })}</dd></div>
                </dl>
              )}
              <div className="cm-project-form cm-project-form--follow">
                <label>
                  <span>{t('profile.companyName')} <small className="cm-field-hint">{t('common.optional')}</small></span>
                  <input value={form.companyName} onChange={(event) => form.setCompanyName(event.target.value)} />
                </label>
                <label>
                  <span>{t('profile.skills')}</span>
                  <input value={form.skills} onChange={(event) => form.setSkills(event.target.value)} placeholder={t('profile.skillsPlaceholder')} />
                </label>
                <label className="is-wide">
                  <span>{t('profile.bio')}</span>
                  <textarea rows={4} maxLength={CM_BIO_MAX_LENGTH} value={form.bio} onChange={(event) => form.setBio(event.target.value)} placeholder={t('profile.bioPlaceholder')} />
                </label>
              </div>
            </section>
          )}
          {hasClientProfile && (
            <section className="cm-section-card">
              <h2><Building2 aria-hidden="true" /> {t('profile.clientTitle')}</h2>
              <p className="cm-section-card__lead">{t('profile.clientLead')}</p>
              {profile.client && (
                <dl className="cm-kv">
                  <div><dt>{t('profile.postedProjects')}</dt><dd>{format.number(profile.client.posted_projects)}</dd></div>
                </dl>
              )}
              <div className="cm-project-form cm-project-form--follow">
                {CM_CLIENT_FIELDS.map((field) => (
                  <label key={field}>
                    <span>{t(`profile.client.${field}`)} <small className="cm-field-hint">{t('common.optional')}</small></span>
                    <input
                      type={field === CM_WEBSITE_FIELD ? 'url' : field === 'contact_phone' ? 'tel' : 'text'}
                      value={client[field]}
                      placeholder={field === CM_WEBSITE_FIELD ? 'https://' : undefined}
                      onChange={(event) => form.setClientField(field, event.target.value)}
                      aria-invalid={field === CM_WEBSITE_FIELD && websiteInvalid}
                    />
                    {field === CM_WEBSITE_FIELD && websiteInvalid && <small className="cm-field-error">{t('profile.websiteInvalid')}</small>}
                  </label>
                ))}
              </div>
            </section>
          )}
          <div className="cm-sticky-actions">
            <CmNotice notice={notice.notice} onDismiss={notice.clear} />
            <button type="submit" className="cm-workspace-button is-primary" disabled={saving || websiteInvalid || nameInvalid}>
              <Save aria-hidden="true" /> {saving ? t('common.saving') : t('profile.save')}
            </button>
          </div>
        </form>
      )}
    </main>
  );
};

export default CmProfilePage;
