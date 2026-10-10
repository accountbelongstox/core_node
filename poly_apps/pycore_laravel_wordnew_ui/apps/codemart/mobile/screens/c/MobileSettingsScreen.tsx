import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CmPasswordInput } from '../../../auth/CmPasswordInput';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { CmAvatarCard } from '../../../components/workspace/CmAvatarCard';
import { CmEmailChangeCard } from '../../../components/workspace/CmEmailChangeCard';
import { useShell } from '../../../../../shell/ShellContext';
import { THEME_IDS, type ThemeId } from '../../../../../shell/shellTypes';
import { useCmPasswordChange } from '../../../shared/useCmPasswordChange';
import { MobilePreferences } from '../../shell/MobilePreferences';
import { MobileButton, MobileCard, MobileField, MobileList, MobileListRow, MobileScreen, MobileSectionHeader, MobileSheet, useMobileFeedback } from '../../ui';

const AUTO_THEME = 'auto';

/** Mobile settings: language and appearance, theme, account links, avatar and email cards, password sheet. */
const MobileSettingsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { themeOverride, setThemeOverride } = useShell();
  const password = useCmPasswordChange(feedback);
  const [passwordOpen, setPasswordOpen] = useState(false);

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
        </MobileList>
        <CmAvatarCard />
        <CmEmailChangeCard />
      </section>

      <section className="cmm-section">
        <MobileSectionHeader title={t('mobile.settings.security')} />
        <MobileList>
          <MobileListRow onClick={() => setPasswordOpen(true)} chevron leading={<KeyRound aria-hidden="true" />} title={t('settings.password.title')} subtitle={t('settings.password.lead')} />
        </MobileList>
      </section>

      <MobileSheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={t('settings.password.title')}
        footer={<MobileButton variant="primary" block loading={password.busy} disabled={password.invalid} onClick={() => void savePassword()}>{password.busy ? t('common.saving') : t('settings.password.submit')}</MobileButton>}
      >
        <MobileField label={t('settings.password.current')}>
          <CmPasswordInput value={password.current} onChange={(event) => password.setCurrent(event.target.value)} autoComplete="current-password" />
        </MobileField>
        <MobileField label={t('settings.password.next')} error={password.tooShort && t('publicAuth.errors.passwordLength', { min: password.passwordMin })}>
          <CmPasswordInput value={password.next} onChange={(event) => password.setNext(event.target.value)} autoComplete="new-password" aria-invalid={password.tooShort} />
        </MobileField>
        <MobileField label={t('settings.password.confirm')} error={password.mismatch && t('publicAuth.errors.passwordMismatch')}>
          <CmPasswordInput value={password.confirm} onChange={(event) => password.setConfirm(event.target.value)} autoComplete="new-password" aria-invalid={password.mismatch} />
        </MobileField>
      </MobileSheet>
    </MobileScreen>
  );
};

export default MobileSettingsScreen;
