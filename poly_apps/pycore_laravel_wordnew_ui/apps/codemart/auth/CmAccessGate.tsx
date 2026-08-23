import React from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useTranslation } from '../../../core/i18n/UiI18n';

export const CmAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('cm');
  const authenticated = useAuthSession();
  if (authenticated) return <>{children}</>;

  return (
    <main className="cm-access-gate" data-end="codemart">
      <section className="cm-access-gate__card">
        <span className="cm-access-gate__icon" aria-hidden="true"><LockKeyhole /></span>
        <h1>{t('common.signInRequired')}</h1>
        <p>{t('common.signInRequiredDescription')}</p>
        <button type="button" onClick={() => requestAuthLogin({ source: 'codemart', reason: 'protected-view' })}>
          {t('common.signIn')}
        </button>
        <Link to="/codemart"><ArrowLeft aria-hidden="true" /> {t('common.backHome')}</Link>
      </section>
    </main>
  );
};

export default CmAccessGate;
