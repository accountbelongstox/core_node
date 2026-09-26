import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../../../../core/auth/AuthSession';
import { cmLoginHref } from '../../auth/cmAuthSession';
import { isCmPublicPath } from './cmPublicRoutes';

/**
 * One entry point for CodeMart links: public paths navigate directly; protected
 * paths navigate when a session exists, otherwise go to the CodeMart sign-in
 * page, which returns to the requested path after sign-in.
 */
export function useCmProtectedNavigate(): (to: string, reason?: string) => void {
  const navigate = useNavigate();

  return useCallback((to: string) => {
    navigate(isCmPublicPath(to) || getAuthToken() ? to : cmLoginHref(to));
  }, [navigate]);
}
