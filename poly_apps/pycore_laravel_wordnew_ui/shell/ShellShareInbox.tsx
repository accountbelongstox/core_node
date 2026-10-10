import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startShareInbox, useShareInbox } from '../shared/share/ShareInbox';

/** Route that hosts the share picker: received files go straight to the terminal page. */
export const SHARE_INBOX_ROUTE = '/pycore-manager/terminal';

/** Starts the global share inbox and brings the picker to the front when a share arrives or waits at start. */
export const ShellShareInbox: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { pickerOpen } = useShareInbox();

  useEffect(() => { startShareInbox(); }, []);
  useEffect(() => {
    if (pickerOpen && pathname !== SHARE_INBOX_ROUTE) navigate(SHARE_INBOX_ROUTE);
  }, [navigate, pathname, pickerOpen]);

  return null;
};

export default ShellShareInbox;
