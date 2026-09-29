import React, { useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

interface CmTransitionBarProps {
  transitions: string[];
  labelFor: (toStatus: string) => string;
  onConfirm: (toStatus: string, reason: string) => Promise<boolean>;
}

const DESTRUCTIVE_TRANSITIONS = new Set(['cancelled', 'blocked']);

/** Server-provided allowed transitions as buttons; each one asks for an optional reason before confirming. */
export const CmTransitionBar: React.FC<CmTransitionBarProps> = ({ transitions, labelFor, onConfirm }) => {
  const { t } = useTranslation('cm');
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (transitions.length === 0) return null;

  const confirm = async (): Promise<void> => {
    if (selected === null || busy) return;
    setBusy(true);
    const done = await onConfirm(selected, reason.trim());
    setBusy(false);
    if (done) {
      setSelected(null);
      setReason('');
    }
  };

  return (
    <div className="cm-transition-bar">
      <div className="cm-table-actions">
        {transitions.map((toStatus) => (
          <button
            key={toStatus}
            type="button"
            className={`cm-workspace-button ${selected === toStatus ? 'is-active' : ''} ${DESTRUCTIVE_TRANSITIONS.has(toStatus) ? 'is-danger-outline' : ''}`}
            disabled={busy}
            aria-pressed={selected === toStatus}
            onClick={() => setSelected(selected === toStatus ? null : toStatus)}
          >
            {labelFor(toStatus)}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="cm-confirm-box">
          <p>{t('transitions.confirmPrompt', { action: labelFor(selected) })}</p>
          <label className="cm-stacked-field">
            <span>{t('transitions.reasonLabel')} <small className="cm-field-hint">{t('common.optional')}</small></span>
            <textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('transitions.reasonPlaceholder')}
            />
          </label>
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? t('common.saving') : t('common.confirm')}
            </button>
            <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setSelected(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CmTransitionBar;
