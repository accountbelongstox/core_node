import React, { useEffect, useRef, useState } from 'react';
import { LaravelLoginModal } from './LaravelLoginModal';
import {
  AUTH_LOGIN_SOURCE_TRANSPORT,
  notifyAuthLoginSuccess,
  subscribeAuthLoginDismiss,
  subscribeAuthLoginRequest,
  type AuthLoginRequestDetail,
} from '../../core/auth/AuthRequestCenter';
import { authNamespaceOf, getActiveAuthNamespace } from '../../core/auth/AuthSession';
import { isAuthBypassed } from '../../core/auth/AuthBypass';
import { getSharedBaseURL } from '../../core/integrations/laravel/transport/BaseAPI';

interface LoginTarget {
  request: AuthLoginRequestDetail;
  baseUrl: string;
}

/** The one shared Laravel login window: opens for the API a request names (default: the active one). */
export const LaravelLoginHost: React.FC = () => {
  const [target, setTarget] = useState<LoginTarget | null>(null);
  const declinedRef = useRef<Set<string>>(new Set());

  useEffect(() => subscribeAuthLoginRequest((detail) => {
    const baseUrl = detail.baseUrl ?? getSharedBaseURL() ?? getActiveAuthNamespace();
    if (!baseUrl || isAuthBypassed(baseUrl)) return;
    const namespace = authNamespaceOf(baseUrl);
    if (detail.source === AUTH_LOGIN_SOURCE_TRANSPORT && declinedRef.current.has(namespace)) return;
    setTarget({ request: detail, baseUrl });
  }), []);

  useEffect(() => subscribeAuthLoginDismiss(() => setTarget(null)), []);

  const handleClose = (): void => {
    if (target) declinedRef.current.add(authNamespaceOf(target.baseUrl));
    setTarget(null);
  };

  const handleSuccess = (user?: unknown): void => {
    const completed = target;
    setTarget(null);
    if (completed) {
      declinedRef.current.delete(authNamespaceOf(completed.baseUrl));
      notifyAuthLoginSuccess(user ?? null, completed.request, authNamespaceOf(completed.baseUrl));
    }
  };

  return (
    <LaravelLoginModal
      isOpen={target !== null}
      onClose={handleClose}
      onSuccess={handleSuccess}
      baseUrl={target?.baseUrl ?? ''}
      blockCloseBackdrop={target?.request.reason === 'protected-view'}
    />
  );
};

export default LaravelLoginHost;
