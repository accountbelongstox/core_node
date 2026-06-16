import { useMemo } from 'react';
import { useUser } from './useUser';

export interface UserRoleInfo {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  roleLevel: number;
  roleName: string;
  canManageInviteCodes: boolean;
  canManageUsers: boolean;
  canManageSystem: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { user } = useUser();

  return useMemo(() => {
    const roleLevel = user?.rolelevel ?? 0;
    const roleName = user?.rolename ?? 'user';

    const isSuperAdmin = roleLevel >= 100;
    const isAdmin = roleLevel >= 10;
    const isModerator = roleLevel >= 5;

    return {
      isAdmin,
      isSuperAdmin,
      isModerator,
      roleLevel,
      roleName,
      canManageInviteCodes: isAdmin,
      canManageUsers: isSuperAdmin,
      canManageSystem: isAdmin
    };
  }, [user?.rolelevel, user?.rolename]);
}
