import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { cmLoginHref } from './cmAuthSession';

/** Signed-out visitors go to the CodeMart sign-in page with the requested path preserved. */
export const CmAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authenticated = useAuthSession();
  const location = useLocation();

  if (authenticated) return <>{children}</>;
  return <Navigate to={cmLoginHref(`${location.pathname}${location.search}${location.hash}`)} replace />;
};

export default CmAccessGate;
