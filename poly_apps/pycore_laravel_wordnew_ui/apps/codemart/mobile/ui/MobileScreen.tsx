import React from 'react';
import { useMobileScreenChrome, MobileAppBarActions, type MobileRefreshHandler } from './mobileChrome';

interface MobileScreenProps {
  /** App bar title; omitted keeps the title of the route. */
  title?: string;
  /** App bar actions (icon buttons) shown at the right of the bar. */
  actions?: React.ReactNode;
  /** Enables pull-to-refresh; resolve when the data has reloaded. */
  onRefresh?: MobileRefreshHandler;
  className?: string;
  children: React.ReactNode;
}

/** The body of a mobile screen: binds title, actions and pull-to-refresh to the app frame. */
export const MobileScreen: React.FC<MobileScreenProps> = ({ title, actions, onRefresh, className = '', children }) => {
  useMobileScreenChrome(title, onRefresh);
  return (
    <div className={`cmm-screen ${className}`.trim()}>
      {actions && <MobileAppBarActions>{actions}</MobileAppBarActions>}
      {children}
    </div>
  );
};
