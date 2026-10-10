import React from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useMobileFrame } from '../ui/mobileChrome';
import { PULL_THRESHOLD_PX, usePullToRefresh } from '../ui/usePullToRefresh';

/** The scrolling content area of the frame, with the pull-to-refresh indicator. */
export const MobileScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('cm');
  const { scrollRef, refreshRef } = useMobileFrame();
  const { pull, refreshing, ready } = usePullToRefresh(scrollRef, refreshRef);
  const progress = Math.min(1, pull / PULL_THRESHOLD_PX);

  return (
    <div className="cmm-scroll" ref={scrollRef}>
      <div className="cmm-ptr" style={{ height: pull, opacity: progress }} aria-hidden={pull === 0}>
        {refreshing
          ? <Loader2 className="cmm-spin" aria-hidden="true" />
          : <ArrowDown style={{ transform: `rotate(${ready ? 180 : 0}deg)` }} aria-hidden="true" />}
        <span>{refreshing ? t('mobile.ui.refreshing') : ready ? t('mobile.ui.releaseToRefresh') : t('mobile.ui.pullToRefresh')}</span>
      </div>
      <div className="cmm-content">{children}</div>
    </div>
  );
};
