import React, { useState } from 'react';
import { ImageUp, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { useCmSignOut } from '../../../auth/useCmSignOut';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useShell } from '../../../../../shell/ShellContext';
import { THEME_IDS, type ThemeId } from '../../../../../shell/shellTypes';
import { useCmPasswordChange } from '../../../shared/useCmPasswordChange';
import { MobilePreferences } from '../../shell/MobilePreferences';
import { AvatarSheet } from './profile/AvatarSheet';
import { EmailChangeSheet } from './profile/EmailChangeSheet';
import { useInlineFeedback } from './parts/useInlineFeedback';
import { MobileButton, MobileCard, MobileField, MobileList, MobileListRow, MobilePasswordInput, MobileScreen, MobileSectionHeader, MobileSheet } from '../../ui';

const AUTO_THEME = 'auto';

/** Mobile settings: language and appearance, theme, account links, avatar and email cards, password sheet. */
const MobileSettingsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const { feedback, notice } = useInlineFeedback();
  const { themeOverride, setThemeOverride } = useShell();
  const password = useCmPasswordChange(feedback);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const { signOut, signingOut } = useCmSignOut();

  const savePassword = async (): Promise<void> => {
    if (await password.submit()) setPasswordOpen(false);
  };

  return (
    <MobileScreen title={t('nav.settings')}>
      <section className="cmm-section">
        <MobileSectionHeader title={t('mobile.settings.preferences')} />
        <MobileCard>
          <MobilePreferences />
          <MobileField label={t('settings.themeTitle')} hint={t('settings.themeLead')}>
            <select
              className="cmm-input"
              value={themeOverride ?? AUTO_THEME}
              onChange={(event) => setThemeOverride(event.target.value === AUTO_THEME ? null : (event.target.value as ThemeId))}
            >
              <option value={AUTO_THEME}>{t('settings.themeAuto')}</option>
              {THEME_IDS.map((themeId) => <option key={themeId} value={themeId}>{t(`settings.themes.${themeId}`)}</option>)}
            </select>
          </MobileField>
        </MobileCard>
      </section>

      <section className="cmm-section">
        <MobileSectionHeader title={t('mobile.settings.account')} />
        <MobileList>
          <MobileListRow to={CM_PROTECTED_ROUTE.profile} leading={<UserRound aria-hidden="true" />} title={t('nav.profile')} />
          <MobileListRow to={CM_PROTECTED_ROUTE.verification} leading={<ShieldCheck aria-hidden="true" />} title={t('nav.verification')} />
          <MobileListRow onClick={() => setAvatarOpen(true)} chevron leading={<ImageUp aria-hidden="true" />} title={t('settings.avatar.title')} />
          <MobileListRow onClick={() => setEmailOpen(true)} chevron leading={<Mail aria-hidden="true" />} title={t('settings.email.title')} />
        </MobileList>
      </section>

      <section className="cmm-section">
        <MobileSectionHeader title={t('mobile.settings.security')} />
        <MobileList>
          <MobileListRow onClick={() => setPasswordOpen(true)} chevron leading={<KeyRound aria-hidden="true" />} title={t('settings.password.title')} subtitle={t('settings.password.lead')} />
        </MobileList>
      </section>

      <section className="cmm-section">
        <MobileList>
          <MobileListRow danger onClick={() => void signOut()} chevron={false} leading={<LogOut aria-hidden="true" />} title={signingOut ? t('nav.signingOut') : t('nav.signOut')} />
        </MobileList>
      </section>

      <MobileSheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={t('settings.password.title')}
        footer={<MobileButton variant="primary" block loading={password.busy} disabled={password.invalid} onClick={() => void savePassword()}>{password.busy ? t('common.saving') : t('settings.password.submit')}</MobileButton>}
      >
        <div className="cmmc-form">
          <MobileField label={t('settings.password.current')}>
            <MobilePasswordInput value={password.current} onChange={(event) => password.setCurrent(event.target.value)} autoComplete="current-password" />
          </MobileField>
          <MobileField label={t('settings.password.next')} error={password.tooShort && t('publicAuth.errors.passwordLength', { min: password.passwordMin })}>
            <MobilePasswordInput value={password.next} onChange={(event) => password.setNext(event.target.value)} autoComplete="new-password" aria-invalid={password.tooShort} />
          </MobileField>
          <MobileField label={t('settings.password.confirm')} error={password.mismatch && t('publicAuth.errors.passwordMismatch')}>
            <MobilePasswordInput value={password.confirm} onChange={(event) => password.setConfirm(event.target.value)} autoComplete="new-password" aria-invalid={password.mismatch} />
          </MobileField>
          {notice}
        </div>
      </MobileSheet>
      <AvatarSheet open={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <EmailChangeSheet open={emailOpen} onClose={() => setEmailOpen(false)} />
    </MobileScreen>
  );
};

export default MobileSettingsScreen;
