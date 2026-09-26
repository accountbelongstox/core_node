import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CM_WORKSPACE_IMAGES } from './cmWorkspaceImages';

export type CmNoticeTone = 'success' | 'error' | 'info';

export interface CmNoticeState {
  tone: CmNoticeTone;
  text: string;
}

export interface CmNoticeController {
  notice: CmNoticeState | null;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
  clear: () => void;
}

/** Page or panel feedback line with a tone (success, error, info). */
export function useCmNotice(): CmNoticeController {
  const [notice, setNotice] = useState<CmNoticeState | null>(null);
  const success = useCallback((text: string) => setNotice({ tone: 'success', text }), []);
  const error = useCallback((text: string) => setNotice({ tone: 'error', text }), []);
  const info = useCallback((text: string) => setNotice({ tone: 'info', text }), []);
  const clear = useCallback(() => setNotice(null), []);
  return { notice, success, error, info, clear };
}

const NOTICE_ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;

export const CmNotice: React.FC<{ notice: CmNoticeState | null; onDismiss?: () => void }> = ({ notice, onDismiss }) => {
  const { t } = useTranslation('cm');
  if (!notice) return null;
  const Icon = NOTICE_ICONS[notice.tone];
  return (
    <div className="cm-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <p>{notice.text}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={t('common.dismiss')}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export const CmLoadingState: React.FC<{ label?: string; compact?: boolean }> = ({ label, compact = false }) => {
  const { t } = useTranslation('cm');
  return (
    <div className={`cm-state cm-state--loading ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
      <Loader2 aria-hidden="true" className="cm-spin" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
};

export const CmErrorState: React.FC<{ message: string; onRetry?: () => void; compact?: boolean }> = ({ message, onRetry, compact = false }) => {
  const { t } = useTranslation('cm');
  return (
    <div className={`cm-state cm-state--error ${compact ? 'is-compact' : ''}`} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{t('common.errorTitle')}</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="cm-workspace-button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" /> {t('common.retry')}
        </button>
      )}
    </div>
  );
};

interface CmEmptyStateProps {
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const CmEmptyState: React.FC<CmEmptyStateProps> = ({ title, body, action, compact = false }) => {
  const image = CM_WORKSPACE_IMAGES.emptyWorkspace;
  return (
    <section className={`cm-state cm-state--empty ${compact ? 'is-compact' : ''}`}>
      {!compact && <img src={image.src} width={image.width} height={image.height} alt="" loading="lazy" decoding="async" />}
      <div>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        {action && <div className="cm-state__action">{action}</div>}
      </div>
    </section>
  );
};
