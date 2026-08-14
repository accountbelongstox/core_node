import React, { useEffect, useState } from 'react';
import LoginModal from './LmLoginModal';
import { userModel } from '../models/UserModel';
import { isDebugAuthBypass } from '../config/auth';
import {
  notifyAuthLoginSuccess,
  subscribeAuthLoginDismiss,
  subscribeAuthLoginRequest,
  type AuthLoginRequestDetail,
} from '../../../core/auth/AuthRequestCenter';
import { useShell } from '../../../shell/ShellContext';

export const LmGlobalLoginHost: React.FC = () => {
  const { lang } = useShell();
  const [request, setRequest] = useState<AuthLoginRequestDetail | null>(null);

  useEffect(() => subscribeAuthLoginRequest((detail) => {
    if (isDebugAuthBypass()) return;
    setRequest(detail);
  }), []);

  useEffect(() => subscribeAuthLoginDismiss(() => setRequest(null)), []);

  const handleSuccess = (): void => {
    const completedRequest = request;
    setRequest(null);
    notifyAuthLoginSuccess(userModel.getUser(), completedRequest);
  };

  return (
    <LoginModal
      isOpen={request !== null}
      onClose={() => setRequest(null)}
      onSuccess={handleSuccess}
      lang={lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'}
      blockCloseBackdrop={request?.reason === 'protected-view'}
    />
  );
};

export default LmGlobalLoginHost;
