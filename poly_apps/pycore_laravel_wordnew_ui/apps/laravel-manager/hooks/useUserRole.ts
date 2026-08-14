import { useMemo } from 'react';
import { useUnifiedApp } from '../context/useUnifiedApp';
import { resolveRoleLevel, resolveRoleName } from '@/apps/laravel-manager/auth/UserIdentity';

export interface UserRoleInfo {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  roleLevel: number;
  roleName: string;
  canManageUsers: boolean;
  canManageSystem: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { UnifiedUser: user } = useUnifiedApp();

  return useMemo(() => {
    const roleLevel = resolveRoleLevel(user);
    const roleName = resolveRoleName(user);

    const isSuperAdmin = roleLevel >= 100;
    const isAdmin = roleLevel >= 10;
    const isModerator = roleLevel >= 5;

    return {
      isAdmin,
      isSuperAdmin,
      isModerator,
      roleLevel,
      roleName,
      canManageUsers: isSuperAdmin,
      canManageSystem: isAdmin
    };
  }, [user]);
}
