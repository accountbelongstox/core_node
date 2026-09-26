import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Code2, Save, UserRound } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProfileResponse } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmJoinList, cmSplitList, useCmFormat } from '../components/workspace/cmWorkspaceFormat';

const DEVELOPER_PROFILE_ROLES = ['developer', 'architect', 'reviewer'] as const;
const CLIENT_PROFILE_ROLE = 'client';
const CLIENT_FIELDS = ['company_name', 'industry', 'contact_person', 'contact_phone', 'company_website'] as const;
const WEBSITE_FIELD = 'company_website';
const URL_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
const NAME_MAX_LENGTH = 100;

type CmClientField = typeof CLIENT_FIELDS[number];

const emptyClient = (): Record<CmClientField, string> => ({ company_name: '', industry: '', contact_person: '', contact_phone: '', company_website: '' });

export const CmProfilePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { refresh } = useCmBootstrap();
  const notice = useCmNotice();
  const [profile, setProfile] = useState<CmProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [client, setClient] = useState<Record<CmClientField, string>>(emptyClient());

  const apply = (data: CmProfileResponse): void => {
    setProfile(data);
    setName(data.user.name ?? '');
    setNickname(data.user.nickname ?? '');
    setCompanyName(data.developer?.company_name ?? '');
    setBio(data.developer?.bio ?? '');
    setSkills(cmJoinList(data.developer?.skills));
    setClient(Object.fromEntries(CLIENT_FIELDS.map((field) => [field, data.client?.[field] ?? ''])) as Record<CmClientField, string>);
  };

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getProfile();
    if (response.success && response.data) {
      apply(response.data);
      setLoadError(null);
    } else {
      setLoadError(cmErrorMessage(t, response, 'profile.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const heldRoles = Object.keys(profile?.roles ?? {});
  const hasDeveloperProfile = DEVELOPER_PROFILE_ROLES.some((role) => heldRoles.includes(role));
  const hasClientProfile = heldRoles.includes(CLIENT_PROFILE_ROLE);
  const websiteInvalid = client.company_website.trim() !== '' && !URL_PATTERN.test(client.company_website.trim());
  const nameInvalid = !name.trim();

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (saving || websiteInvalid || nameInvalid) return;
    setSaving(true);
    notice.clear();
    const payload: Record<string, unknown> = { name: name.trim(), nickname: nickname.trim() };
    if (hasDeveloperProfile) {
      payload.developer = { company_name: companyName.trim(), bio: bio.trim(), skills: cmSplitList(skills) };
    }
    if (hasClientProfile) {
      payload.client = Object.fromEntries(CLIENT_FIELDS.map((field) => [field, client[field].trim()]));
    }
    const response = await cmApi.updateProfile(payload);
    setSaving(false);
    if (response.success) {
      notice.success(t('profile.saved'));
      if (response.data?.user) apply(response.data);
      else await load();
      await refresh();
    } else {
      notice.error(cmErrorMessage(t, response, 'profile.saveFailed'));
    }
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader eyebrowKey="profile.eyebrow" titleKey="nav.profile" purposeKey="profile.description" />
      {loading && !profile ? (
        <CmLoadingState />
      ) : loadError || !profile ? (
        <CmErrorState message={loadError ?? t('profile.loadFailed')} onRetry={() => void load()} />
      ) : (
        <form onSubmit={(event) => void save(event)} noValidate>
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
                <input value={name} maxLength={NAME_MAX_LENGTH} autoComplete="name" onChange={(event) => setName(event.target.value)} aria-invalid={nameInvalid} />
                {nameInvalid ? <small className="cm-field-error">{t('profile.nameRequired')}</small> : <small className="cm-field-hint">{t('profile.nameHint')}</small>}
              </label>
              <label>
                <span>{t('profile.nickname')} <small className="cm-field-hint">{t('common.optional')}</small></span>
                <input value={nickname} maxLength={NAME_MAX_LENGTH} autoComplete="nickname" onChange={(event) => setNickname(event.target.value)} />
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
                  <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                </label>
                <label>
                  <span>{t('profile.skills')}</span>
                  <input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder={t('profile.skillsPlaceholder')} />
                </label>
                <label className="is-wide">
                  <span>{t('profile.bio')}</span>
                  <textarea rows={4} maxLength={2000} value={bio} onChange={(event) => setBio(event.target.value)} placeholder={t('profile.bioPlaceholder')} />
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
                {CLIENT_FIELDS.map((field) => (
                  <label key={field}>
                    <span>{t(`profile.client.${field}`)} <small className="cm-field-hint">{t('common.optional')}</small></span>
                    <input
                      type={field === WEBSITE_FIELD ? 'url' : field === 'contact_phone' ? 'tel' : 'text'}
                      value={client[field]}
                      placeholder={field === WEBSITE_FIELD ? 'https://' : undefined}
                      onChange={(event) => setClient((current) => ({ ...current, [field]: event.target.value }))}
                      aria-invalid={field === WEBSITE_FIELD && websiteInvalid}
                    />
                    {field === WEBSITE_FIELD && websiteInvalid && <small className="cm-field-error">{t('profile.websiteInvalid')}</small>}
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
