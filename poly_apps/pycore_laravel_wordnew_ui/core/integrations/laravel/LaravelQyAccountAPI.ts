import { BaseAPI } from './transport/BaseAPI';
import { createFixedLaravelModuleConfig, LARAVEL_API_PREFIX, LARAVEL_API_ROUTE } from './transport/ApiContract';
import { readLaravelResponse } from './LaravelRequest';

export interface QyAccountUser {
  id?: number;
  username?: string;
  native_language?: string;
}

export interface QyAccountCredentials {
  token: string;
  user: QyAccountUser;
}

export interface QyWordGroup {
  gid: string;
  gname: string;
  language?: string;
  total_words?: number;
  is_default?: boolean;
  is_language_default?: boolean;
}

type AccountEnvelope = {
  success?: boolean;
  message?: string;
  token?: unknown;
  login_token?: string;
  user?: QyAccountUser;
  data?: Record<string, unknown>;
};

export class LaravelQyAccountAPI {
  constructor(private readonly baseURL: string) {}

  async login(username: string, password: string): Promise<QyAccountCredentials> {
    const http = new BaseAPI(createFixedLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1, this.baseURL, 60_000));
    const response = await http.rawRequest(LARAVEL_API_ROUTE.auth.login, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    }, false);
    const body = await readLaravelResponse<AccountEnvelope>(response, LARAVEL_API_ROUTE.auth.login);
    const data = body.data || {};
    const candidate = body.login_token || body.token || data.login_token || data.token || data.access_token;
    const token = typeof candidate === 'string' ? candidate
      : candidate && typeof candidate === 'object'
        ? (candidate as Record<string, unknown>).accessToken || (candidate as Record<string, unknown>).access_token
        : null;
    const user = (data.user || body.user || {}) as QyAccountUser;
    if (body.success === false || typeof token !== 'string' || !token || !user.id) {
      throw new Error(body.message || 'QY_ACCOUNT_LOGIN_REJECTED');
    }
    return { token, user };
  }
}
