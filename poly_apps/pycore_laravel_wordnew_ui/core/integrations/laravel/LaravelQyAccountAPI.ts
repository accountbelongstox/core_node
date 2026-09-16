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

  async groups(token: string): Promise<QyWordGroup[]> {
    const http = new BaseAPI(createFixedLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1, this.baseURL, 60_000));
    const groups: QyWordGroup[] = [];
    const limit = 1000;
    let start = 0;
    while (true) {
      const path = `/query_all_groups?start=${start}&limit=${limit}&with_words=0`;
      const response = await http.rawRequest(path, {
        method: 'GET', credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }, false);
      const body = await readLaravelResponse<{ data?: { groups?: QyWordGroup[] } }>(response, path);
      const page = body.data?.groups;
      if (!Array.isArray(page)) throw new Error('QY_WORD_GROUPS_PAYLOAD_INVALID');
      groups.push(...page);
      if (page.length < limit) return groups;
      start += limit;
    }
  }

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
