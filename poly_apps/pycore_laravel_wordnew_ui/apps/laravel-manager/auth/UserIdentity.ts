import type { UnifiedUser } from '../types';

export interface LaravelUserPayload extends Omit<Partial<UnifiedUser>, 'id' | 'username' | 'role' | 'role_level' | 'role_name' | 'rolelevel'> {
  id?: string | number | null;
  username?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  name?: string | null;
  bio?: string | null;
  location?: string | null;
  role?: string | null;
  role_level?: number | string | null;
  role_name?: string | null;
  rolelevel?: number | string | null;
}

const ROLE_LEVEL = {
  user: 0,
  moderator: 5,
  admin: 10,
  administrator: 10,
  super_admin: 100,
  'super-admin': 100,
  superadmin: 100,
} as const;

export function resolveRoleLevel(user: LaravelUserPayload | null | undefined): number {
  const explicit = user?.rolelevel ?? user?.role_level;
  const numeric = Number(explicit);
  if (explicit !== undefined && explicit !== null && Number.isFinite(numeric)) return numeric;
  const name = String(user?.rolename ?? user?.role_name ?? user?.role ?? 'user').trim().toLowerCase();
  return ROLE_LEVEL[name as keyof typeof ROLE_LEVEL] ?? 0;
}

export function resolveRoleName(user: LaravelUserPayload | null | undefined): string {
  const explicit = user?.rolename ?? user?.role_name ?? user?.role;
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit.trim();
  const level = resolveRoleLevel(user);
  if (level >= 100) return 'super_admin';
  if (level >= 10) return 'admin';
  if (level >= 5) return 'moderator';
  return 'user';
}

export function normalizeLaravelUser(data: unknown): UnifiedUser | null {
  const envelope = data as Record<string, any> | null;
  const payload = envelope?.data ?? envelope;
  const raw = (payload?.user ?? payload?.UnifiedUser ?? payload) as LaravelUserPayload | null;
  if (!raw || raw.id === undefined || raw.id === null || typeof raw.username !== 'string' || raw.username === '') return null;
  return {
    ...raw,
    id: String(raw.id),
    username: raw.username,
    email: typeof raw.email === 'string' ? raw.email : '',
    rolelevel: resolveRoleLevel(raw),
    rolename: resolveRoleName(raw),
  } as UnifiedUser;
}

export const hasAdministratorAccess = (user: LaravelUserPayload | null | undefined): boolean => resolveRoleLevel(user) >= 10;
export const hasSuperAdministratorAccess = (user: LaravelUserPayload | null | undefined): boolean => resolveRoleLevel(user) >= 100;
