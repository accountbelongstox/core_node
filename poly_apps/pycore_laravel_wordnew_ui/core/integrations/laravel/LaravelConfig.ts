import {
  DEFAULT_LARAVEL_API_ORIGIN,
  LARAVEL_API_BACKEND_PORT,
} from '../../contracts/ServiceContract';

export const DEFAULT_API_PORT = LARAVEL_API_BACKEND_PORT;
export const DEFAULT_API_TIMEOUT = 30000;

export function getDefaultBaseURL(): string {
  return DEFAULT_LARAVEL_API_ORIGIN;
}
