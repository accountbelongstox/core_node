import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useMobileOverlay } from './useMobileOverlay';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Sticky action area under the content (primary button row). */
  footer?: React.ReactNode;
}

/** Bottom sheet for actions and forms; closes on scrim tap, Escape and the Android back button. */
export const MobileSheet: React.FC<MobileSheetProps> = ({ open, onClose, title, children, footer }) => {
  const { t } = useTranslation('cm');
  useMobileOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="cmm-sheet-layer">
      <button type="button" className="cmm-scrim" aria-label={t('mobile.ui.close')} onClick={onClose} />
      <div className="cmm-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="cmm-sheet__grip" aria-hidden="true" />
        <header className="cmm-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="cmm-icon-btn" onClick={onClose} aria-label={t('mobile.ui.close')}><X aria-hidden="true" /></button>
        </header>
        <div className="cmm-sheet__body">{children}</div>
        {footer && <footer className="cmm-sheet__foot">{footer}</footer>}
      </div>
    </div>
  );
};
