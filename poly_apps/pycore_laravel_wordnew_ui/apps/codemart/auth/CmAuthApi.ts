import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
  LARAVEL_API_ROUTE,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmHandleUnauthorized } from './cmAuthSession';

const accountRoute = (route: string): string => `${LARAVEL_API_PREFIX.common}${route}`;

/** Shared account routes (root requests) used by the CodeMart sign-in and password flows. */
export const CM_ACCOUNT_ROUTE = {
  login: accountRoute(LARAVEL_API_ROUTE.auth.login),
  logout: accountRoute(LARAVEL_API_ROUTE.auth.logout),
  forgotPassword: accountRoute(LARAVEL_API_ROUTE.auth.forgotPassword),
  resetPassword: accountRoute(LARAVEL_API_ROUTE.auth.resetPassword),
  changePassword: accountRoute(LARAVEL_API_ROUTE.auth.password),
} as const;

export interface CmLoginUser {
  id: number;
  username: string;
  nickname?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface CmLoginResult {
  token: string;
  token_type: string;
  expiration: string | null;
  user: CmLoginUser;
}

/** Shared account endpoints (root routes) used by the CodeMart sign-in flow. */
export class CmAuthApi extends BaseAPI {
  constructor() {
    super({ ...createLaravelModuleConfig(LARAVEL_API_PREFIX.codeMartV1), onUnauthorized: cmHandleUnauthorized });
  }

  login(username: string, password: string): Promise<APIResponse<CmLoginResult>> {
    return this.request<CmLoginResult>({
      url: CM_ACCOUNT_ROUTE.login,
      method: 'POST',
      data: { username, password },
      root: true,
      retry: false,
    });
  }

  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<APIResponse<unknown>> {
    return this.request<unknown>({
      url: CM_ACCOUNT_ROUTE.changePassword,
      method: 'POST',
      data: { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword },
      root: true,
      retry: false,
    });
  }

  logout(): Promise<APIResponse<{ message?: string }>> {
    return this.request<{ message?: string }>({ url: CM_ACCOUNT_ROUTE.logout, method: 'POST', root: true, retry: false });
  }
}

export const cmAuthApi = new CmAuthApi();
