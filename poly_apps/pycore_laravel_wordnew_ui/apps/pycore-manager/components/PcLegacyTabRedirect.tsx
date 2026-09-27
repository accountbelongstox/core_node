import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { END_META } from '../../../shell/shellTypes';
import { PC_LEGACY_TAB_REDIRECTS } from '../pcPages';

const TAB_PARAM = 'tab';

/** Renders the page, or redirects a former `?tab=` link to the page that replaced that tab. */
export const PcLegacyTabRedirect: React.FC<{ pageId: string; children: React.ReactNode }> = ({ pageId, children }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get(TAB_PARAM);
  const target = tab ? PC_LEGACY_TAB_REDIRECTS.find((entry) => entry.page === pageId && entry.tab === tab) : undefined;
  if (!target) return <>{children}</>;
  params.delete(TAB_PARAM);
  return <Navigate to={{ pathname: `${END_META['pycore-manager'].path}/${target.to}`, search: params.toString() }} replace />;
};
