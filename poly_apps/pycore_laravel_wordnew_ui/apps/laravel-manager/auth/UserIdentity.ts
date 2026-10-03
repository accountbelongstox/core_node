import type { UnifiedUser } from '../types';
import { normalizeLaravelUser as normalizeSessionUser } from '../../../core/auth/LaravelUser';

export {
  hasAdministratorAccess,
  hasSuperAdministratorAccess,
  resolveRoleLevel,
  resolveRoleName,
} from '../../../core/auth/LaravelUser';
export type { LaravelUserPayload } from '../../../core/auth/LaravelUser';

export function normalizeLaravelUser(data: unknown): UnifiedUser | null {
  return normalizeSessionUser(data) as UnifiedUser | null;
}
