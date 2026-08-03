import { BaseAPI } from './BaseAPI';
import type { APIResponse } from './TransportTypes';
import { LARAVEL_API_ROUTE } from './ApiContract';

export interface LaravelHealthPayload {
  status?: string;
  service?: string;
  [key: string]: unknown;
}

export class EndpointProbeAPI extends BaseAPI {
  probeHealth(baseURL: string, timeout: number): Promise<APIResponse<LaravelHealthPayload>> {
    return this.request<LaravelHealthPayload>({
      url: LARAVEL_API_ROUTE.health,
      baseURL,
      method: 'GET',
      timeout,
      retry: false,
    });
  }
}
