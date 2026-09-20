import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProfileResponse } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

export const CmProfilePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [profile, setProfile] = useState<CmProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getProfile();
    if (response.success && response.data) {
      setProfile(response.data);
      setName(response.data.user.name ?? '');
      setNickname(response.data.user.nickname ?? '');
      setCompanyName(response.data.developer?.company_name ?? response.data.client?.company_name ?? '');
      setBio(response.data.developer?.bio ?? '');
      setSkills((response.data.developer?.skills ?? []).join(', '));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const response = await cmApi.updateProfile({
      name,
      nickname,
      developer: {
        company_name: companyName,
        bio,
        skills: skills.split(',').map((skill) => skill.trim()).filter((skill) => skill !== ''),
      },
      client: { company_name: companyName },
    });
    setNotice(response.success ? t('profile.saved') : t('profile.saveFailed'));
    setSaving(false);
    await load();
    await refresh();
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('profile.eyebrow')}</span>
        <h1>{t('nav.profile')}</h1>
        <p>{t('profile.description')}</p>
        <button type="button" className="cm-workspace-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <>
          {profile && (
            <section className="cm-dashboard-section">
              <h2>{t('profile.rolesTitle')}</h2>
              <div className="cm-record-card__meta">
                {Object.entries(profile.roles).map(([role, status]) => (
                  <span key={role} className="cm-status" data-status={status}>
                    {t(`roles.${role}`)}: {t(`states.role.${status}`)}
                  </span>
                ))}
              </div>
            </section>
          )}
          <form className="cm-project-form" onSubmit={(event) => void save(event)}>
            <label>
              <span>{t('profile.name')}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>{t('profile.nickname')}</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
            </label>
            <label>
              <span>{t('profile.companyName')}</span>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </label>
            <label className="is-wide">
              <span>{t('profile.bio')}</span>
              <textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
            </label>
            <label className="is-wide">
              <span>{t('profile.skills')}</span>
              <input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder={t('profile.skillsPlaceholder')} />
            </label>
            <div className="cm-project-form__actions">
              <button type="submit" className="is-primary" disabled={saving}>
                <Save aria-hidden="true" /> {saving ? t('common.loading') : t('profile.save')}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
};

export default CmProfilePage;
