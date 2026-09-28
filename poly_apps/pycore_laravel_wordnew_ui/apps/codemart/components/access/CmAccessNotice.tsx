import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, type LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmPageTitle } from '../public-home/useCmPageTitle';

export interface CmAccessAction {
  key: string;
  to: string;
  label: string;
  Icon?: LucideIcon;
  primary?: boolean;
}

export interface CmAccessNoticeProps {
  Icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  bodyValues?: Record<string, unknown>;
  hints?: string[];
  actions?: CmAccessAction[];
  back?: { to: string; label: string };
  onRetry?: () => void;
  standalone?: boolean;
  tone?: 'info' | 'warning';
}

/**
 * Explains why a CodeMart page cannot be opened (missing role, administrator
 * only, access check failed) and offers the way forward.
 */
export const CmAccessNotice: React.FC<CmAccessNoticeProps> = ({
  Icon,
  titleKey,
  bodyKey,
  bodyValues,
  hints = [],
  actions = [],
  back,
  onRetry,
  standalone = false,
  tone = 'info',
}) => {
  const { t } = useTranslation('cm');
  useCmPageTitle(titleKey, bodyKey);

  const card = (
    <section className={`cm-access-notice is-${tone}`} aria-labelledby="cm-access-notice-title">
      <span className="cm-access-notice__icon" aria-hidden="true"><Icon /></span>
      <h1 id="cm-access-notice-title">{t(titleKey)}</h1>
      <p className="cm-access-notice__body">{t(bodyKey, bodyValues)}</p>
      {hints.length > 0 && (
        <ul className="cm-access-notice__hints">
          {hints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
      )}
      {(actions.length > 0 || onRetry) && (
        <div className="cm-access-notice__actions">
          {onRetry && (
            <button type="button" className="cm-access-notice__action is-primary" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> {t('common.refresh')}
            </button>
          )}
          {actions.map(({ key, to, label, Icon: ActionIcon, primary }) => (
            <Link key={key} to={to} className={`cm-access-notice__action ${primary ? 'is-primary' : ''}`}>
              {ActionIcon && <ActionIcon aria-hidden="true" />} {label}
            </Link>
          ))}
        </div>
      )}
      {back && (
        <Link to={back.to} className="cm-access-notice__back">
          <ArrowLeft aria-hidden="true" /> {back.label}
        </Link>
      )}
    </section>
  );

  if (standalone) {
    return <main className="cm-access-notice-page is-standalone" data-end="codemart">{card}</main>;
  }
  return <main className="cm-workspace-page cm-access-notice-page">{card}</main>;
};

export default CmAccessNotice;
