import { BaseAPI } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  createLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmHandleUnauthorized } from './cmAuthSession';

const LOGIN_PATH = 'api/login';
const LOGOUT_PATH = 'api/logout';

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
      url: LOGIN_PATH,
      method: 'POST',
      data: { username, password },
      root: true,
      retry: false,
    });
  }

  logout(): Promise<APIResponse<{ message?: string }>> {
    return this.request<{ message?: string }>({ url: LOGOUT_PATH, method: 'POST', root: true, retry: false });
  }
}

export const cmAuthApi = new CmAuthApi();
