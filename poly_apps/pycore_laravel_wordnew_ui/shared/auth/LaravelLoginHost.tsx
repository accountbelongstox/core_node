import React, { useEffect, useState } from 'react';
import { LaravelLoginModal } from './LaravelLoginModal';
import {
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

  useEffect(() => subscribeAuthLoginRequest((detail) => {
    const baseUrl = detail.baseUrl ?? getSharedBaseURL() ?? getActiveAuthNamespace();
    if (!baseUrl || isAuthBypassed(baseUrl)) return;
    setTarget({ request: detail, baseUrl });
  }), []);

  useEffect(() => subscribeAuthLoginDismiss(() => setTarget(null)), []);

  const handleSuccess = (user?: unknown): void => {
    const completed = target;
    setTarget(null);
    if (completed) {
      notifyAuthLoginSuccess(user ?? null, completed.request, authNamespaceOf(completed.baseUrl));
    }
  };

  return (
    <LaravelLoginModal
      isOpen={target !== null}
      onClose={() => setTarget(null)}
      onSuccess={handleSuccess}
      baseUrl={target?.baseUrl ?? ''}
      blockCloseBackdrop={target?.request.reason === 'protected-view'}
    />
  );
};

export default LaravelLoginHost;
