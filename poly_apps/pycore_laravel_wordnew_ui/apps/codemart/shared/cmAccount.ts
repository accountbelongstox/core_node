import { useMemo } from 'react';
import type { CmBootstrapUser } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

/** The name an account is shown with: display name, nickname, then username. */
export function cmUserDisplayName(user: Pick<CmBootstrapUser, 'name' | 'nickname' | 'username'> | null | undefined): string {
  return user?.name || user?.nickname || user?.username || '';
}

export interface CmHeldRole {
  role: string;
  status: string;
}

export interface CmAccount {
  displayName: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  initial: string;
  isAdmin: boolean;
  heldRoles: CmHeldRole[];
}

/** Signed-in account summary (name, avatar, held roles with their server status) from the bootstrap. */
export function useCmAccount(): CmAccount | null {
  const { bootstrap, roles } = useCmBootstrap();
  return useMemo(() => {
    if (!bootstrap) return null;
    const displayName = cmUserDisplayName(bootstrap.user);
    return {
      displayName,
      username: bootstrap.user.username,
      email: bootstrap.user.email,
      avatarUrl: bootstrap.user.avatar_url ?? null,
      initial: (displayName || bootstrap.user.username || '?').trim().charAt(0).toUpperCase(),
      isAdmin: bootstrap.is_admin,
      heldRoles: roles.filter((role) => bootstrap.roles[role] !== undefined).map((role) => ({ role, status: bootstrap.roles[role] })),
    };
  }, [bootstrap, roles]);
}
