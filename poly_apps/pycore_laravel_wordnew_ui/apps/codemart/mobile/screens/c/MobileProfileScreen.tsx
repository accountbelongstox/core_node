import React, { useState } from 'react';
import { BadgeCheck, Bell, Camera, LogOut, Mail, Settings, ShieldCheck, Wallet } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { useCmSignOut } from '../../../auth/useCmSignOut';
import { CM_ADMIN_ROUTE, CM_PROTECTED_ROUTE, cmWorkspacePath } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmAccount } from '../../../shared/cmAccount';
import { CM_BIO_MAX_LENGTH, CM_CLIENT_FIELDS, CM_NAME_MAX_LENGTH, CM_WEBSITE_FIELD, useCmProfile } from '../../../shared/useCmProfile';
import {
  MobileButton,
  MobileCard,
  MobileErrorState,
  MobileField,
  MobileList,
  MobileListRow,
  MobileScreen,
  MobileSectionHeader,
  MobileSkeletonBlock,
  MobileStatusBadge,
  useMobileFeedback,
} from '../../ui';
import { AvatarSheet } from './profile/AvatarSheet';
import { EmailChangeSheet } from './profile/EmailChangeSheet';

const CLIENT_FIELD_INPUT_MODE: Record<string, React.HTMLAttributes<HTMLInputElement>['inputMode']> = {
  contact_phone: 'tel',
  company_website: 'url',
};

/** Mobile profile (Me tab): account card, held roles, the profile form of those roles, shortcuts and sign-out. */
const MobileProfileScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const account = useCmAccount();
  const { hasCapability } = useCmBootstrap();
  const { signOut, signingOut } = useCmSignOut();
  const form = useCmProfile(feedback);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const { profile, loading, loadError, loadRetryable, saving, hasDeveloperProfile, hasClientProfile, websiteInvalid, nameInvalid, client } = form;

  return (
    <MobileScreen title={t('nav.profile')} onRefresh={form.reload}>
      {account && (
        <MobileCard className="cmmc-identity">
          <button type="button" className="cmmc-identity__avatar" onClick={() => setAvatarOpen(true)} aria-label={t('settings.avatar.title')}>
            {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <span>{account.initial}</span>}
            <i><Camera aria-hidden="true" /></i>
          </button>
          <div className="cmmc-identity__text">
            <strong>{account.displayName || account.username}</strong>
            <small>@{account.username}</small>
            <button type="button" className="cmmc-identity__email" onClick={() => setEmailOpen(true)}>
              <Mail aria-hidden="true" /><span>{account.email ?? t('common.unavailable')}</span>
            </button>
          </div>
          <div className="cmmc-identity__roles" aria-label={t('profile.rolesTitle')}>
            {account.heldRoles.length === 0 && <span className="cmm-badge">{account.isAdmin ? t('dashboard.adminOnly') : t('profile.noRoles')}</span>}
            {account.heldRoles.map((item) => (
              <span key={item.role} className="cmm-role">{t(`roles.${item.role}`, { defaultValue: item.role })} <MobileStatusBadge group="role" status={item.status} /></span>
            ))}
          </div>
        </MobileCard>
      )}

      {loading && !profile ? (
        <MobileSkeletonBlock height={220} />
      ) : loadError || !profile ? (
        <MobileErrorState message={loadError ?? t('profile.loadFailed')} onRetry={loadRetryable ? () => void form.reload() : undefined} />
      ) : (
        <>
          <section className="cmm-section">
            <MobileSectionHeader title={t('profile.accountTitle')} />
            <MobileCard>
              <div className="cmmc-form">
                <MobileField label={t('profile.name')} error={nameInvalid && t('profile.nameRequired')} hint={t('profile.nameHint')}>
                  <input className="cmm-input" value={form.name} maxLength={CM_NAME_MAX_LENGTH} autoComplete="name" aria-invalid={nameInvalid} onChange={(event) => form.setName(event.target.value)} />
                </MobileField>
                <MobileField label={`${t('profile.nickname')} (${t('common.optional')})`}>
                  <input className="cmm-input" value={form.nickname} maxLength={CM_NAME_MAX_LENGTH} autoComplete="nickname" onChange={(event) => form.setNickname(event.target.value)} />
                </MobileField>
              </div>
            </MobileCard>
          </section>

          {hasDeveloperProfile && (
            <section className="cmm-section">
              <MobileSectionHeader title={t('profile.developerTitle')} />
              <MobileCard>
                <p className="cmm-muted">{t('profile.developerLead')}</p>
                {profile.developer && (
                  <ul className="cmmc-stats">
                    <li><strong>{format.number(profile.developer.completed_projects)}</strong><small>{t('profile.completedProjects')}</small></li>
                    <li><strong>{t('profile.ratingValue', { rating: profile.developer.average_rating })}</strong><small>{t('profile.averageRating')}</small></li>
                  </ul>
                )}
                <div className="cmmc-form">
                  <MobileField label={`${t('profile.companyName')} (${t('common.optional')})`}>
                    <input className="cmm-input" value={form.companyName} onChange={(event) => form.setCompanyName(event.target.value)} />
                  </MobileField>
                  <MobileField label={t('profile.skills')}>
                    <input className="cmm-input" value={form.skills} placeholder={t('profile.skillsPlaceholder')} onChange={(event) => form.setSkills(event.target.value)} />
                  </MobileField>
                  <MobileField label={t('profile.bio')}>
                    <textarea className="cmm-input cmmc-textarea" rows={4} maxLength={CM_BIO_MAX_LENGTH} value={form.bio} placeholder={t('profile.bioPlaceholder')} onChange={(event) => form.setBio(event.target.value)} />
                  </MobileField>
                </div>
              </MobileCard>
            </section>
          )}

          {hasClientProfile && (
            <section className="cmm-section">
              <MobileSectionHeader title={t('profile.clientTitle')} />
              <MobileCard>
                <p className="cmm-muted">{t('profile.clientLead')}</p>
                {profile.client && (
                  <ul className="cmmc-stats">
                    <li><strong>{format.number(profile.client.posted_projects)}</strong><small>{t('profile.postedProjects')}</small></li>
                  </ul>
                )}
                <div className="cmmc-form">
                  {CM_CLIENT_FIELDS.map((field) => (
                    <MobileField key={field} label={`${t(`profile.client.${field}`)} (${t('common.optional')})`} error={field === CM_WEBSITE_FIELD && websiteInvalid && t('profile.websiteInvalid')}>
                      <input
                        className="cmm-input"
                        type={field === CM_WEBSITE_FIELD ? 'url' : field === 'contact_phone' ? 'tel' : 'text'}
                        inputMode={CLIENT_FIELD_INPUT_MODE[field]}
                        value={client[field]}
                        placeholder={field === CM_WEBSITE_FIELD ? 'https://' : undefined}
                        aria-invalid={field === CM_WEBSITE_FIELD && websiteInvalid}
                        onChange={(event) => form.setClientField(field, event.target.value)}
                      />
                    </MobileField>
                  ))}
                </div>
              </MobileCard>
            </section>
          )}

          <div className="cmmc-save">
            <MobileButton variant="primary" block loading={saving} disabled={websiteInvalid || nameInvalid} onClick={() => void form.save()}>{saving ? t('common.saving') : t('profile.save')}</MobileButton>
          </div>
        </>
      )}

      <section className="cmm-section">
        <MobileList>
          {hasCapability('finance.read') && <MobileListRow to={CM_PROTECTED_ROUTE.wallet} leading={<Wallet aria-hidden="true" />} title={t('nav.wallet')} />}
          {hasCapability('onboarding.read') && <MobileListRow to={CM_PROTECTED_ROUTE.verification} leading={<BadgeCheck aria-hidden="true" />} title={t('nav.verification')} />}
          {hasCapability('notification.read') && <MobileListRow to={CM_PROTECTED_ROUTE.notifications} leading={<Bell aria-hidden="true" />} title={t('nav.notifications')} />}
          <MobileListRow to={cmWorkspacePath('settings')} leading={<Settings aria-hidden="true" />} title={t('nav.settings')} />
          {account?.isAdmin && <MobileListRow to={CM_ADMIN_ROUTE.home} leading={<ShieldCheck aria-hidden="true" />} title={t('admin.nav.overview')} subtitle={t('mobile.c.admin.consoleHint')} />}
          <MobileListRow danger onClick={() => void signOut()} leading={<LogOut aria-hidden="true" />} title={signingOut ? t('nav.signingOut') : t('nav.signOut')} chevron={false} />
        </MobileList>
      </section>

      <AvatarSheet open={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <EmailChangeSheet open={emailOpen} onClose={() => setEmailOpen(false)} />
    </MobileScreen>
  );
};

export default MobileProfileScreen;
