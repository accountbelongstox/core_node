import React from 'react';
import { ChevronLeft, Menu } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

interface MobileAppBarProps {
  title: string;
  /** Menu button (top-level screens) or back arrow (detail screens). */
  leading: 'menu' | 'back' | 'none';
  onLeading: () => void;
  setActionsSlot: (element: HTMLElement | null) => void;
  brand?: React.ReactNode;
}

export const MobileAppBar: React.FC<MobileAppBarProps> = ({ title, leading, onLeading, setActionsSlot, brand }) => {
  const { t } = useTranslation('cm');
  return (
    <header className="cmm-appbar">
      {leading !== 'none' && (
        <button type="button" className="cmm-icon-btn" onClick={onLeading} aria-label={leading === 'menu' ? t('mobile.shell.openMenu') : t('mobile.shell.back')}>
          {leading === 'menu' ? <Menu aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        </button>
      )}
      {brand ?? <h1 className="cmm-appbar__title">{title}</h1>}
      <div className="cmm-appbar__actions" ref={setActionsSlot} />
    </header>
  );
};
