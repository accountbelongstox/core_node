import React, { useState } from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { MobileButton, MobileConfirmSheet } from '../../../ui';

const DESTRUCTIVE_TRANSITIONS = new Set(['cancelled', 'blocked']);

interface MobileTransitionActionsProps {
  /** Transitions the server allows for the viewer right now. */
  transitions: string[];
  labelFor: (toStatus: string) => string;
  onConfirm: (toStatus: string, reason: string) => Promise<boolean>;
}

/** Server-provided transitions as buttons; each one asks for confirmation and an optional reason in a sheet. */
export const MobileTransitionActions: React.FC<MobileTransitionActionsProps> = ({ transitions, labelFor, onConfirm }) => {
  const { t } = useTranslation('cm');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (transitions.length === 0) return null;

  const confirm = async (reason: string): Promise<void> => {
    if (selected === null || busy) return;
    setBusy(true);
    const done = await onConfirm(selected, reason);
    setBusy(false);
    if (done) setSelected(null);
  };

  return (
    <>
      <div className="cmm-row-actions">
        {transitions.map((toStatus) => (
          <MobileButton key={toStatus} small variant={DESTRUCTIVE_TRANSITIONS.has(toStatus) ? 'danger' : 'secondary'} onClick={() => setSelected(toStatus)}>
            {labelFor(toStatus)}
          </MobileButton>
        ))}
      </div>
      <MobileConfirmSheet
        open={selected !== null}
        title={selected ? labelFor(selected) : ''}
        message={selected ? t('transitions.confirmPrompt', { action: labelFor(selected) }) : ''}
        busy={busy}
        danger={selected !== null && DESTRUCTIVE_TRANSITIONS.has(selected)}
        withReason
        onClose={() => setSelected(null)}
        onConfirm={confirm}
      />
    </>
  );
};
