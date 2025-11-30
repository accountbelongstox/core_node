// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { useAppStore } from '@/stores/index';
import type { Role } from '@/stores/index';

export const useRoles = () => {
    const appStore = useAppStore();

    // 获取所有角色
    const getAllRoles = () => appStore.getRoles();

    // 获取任务管理员角色
    const getTaskAdminRoles = () => appStore.getTaskAdminRoles();

    // 获取测试平台管理员角色
    const getTestPlatformAdminRoles = () => appStore.getTestPlatformAdminRoles();

    // 根据级别获取角色
    const getRolesByLevel = (minLevel: number = 1, maxLevel: number = 10) => 
        appStore.getRolesByLevel(minLevel, maxLevel);

    // 获取当前用户角色
    const getCurrentUserRole = () => appStore.getUserRole();

    // 检查当前用户是否有特定权限
    const hasPermission = (permission: string) => appStore.hasPermission(permission);

    // 设置用户角色
    const setUserRole = (roleId: string) => appStore.setUserRole(roleId);

    // 获取角色描述
    const getRoleDescription = (roleId: string) => {
        const role = appStore.getRoles().find(r => r.id === roleId);
        return role?.description || '';
    };

    // 获取角色权限列表
    const getRolePermissions = (roleId: string) => {
        const role = appStore.getRoles().find(r => r.id === roleId);
        return role?.permissions || [];
    };

    // 检查角色是否有特定权限
    const roleHasPermission = (roleId: string, permission: string) => {
        const permissions = getRolePermissions(roleId);
        return permissions.includes('*') || permissions.includes(permission);
    };

    // 获取角色级别
    const getRoleLevel = (roleId: string) => {
        const role = appStore.getRoles().find(r => r.id === roleId);
        return role?.level || 0;
    };

    // 比较角色级别
    const isRoleHigherThan = (roleId1: string, roleId2: string) => {
        const level1 = getRoleLevel(roleId1);
        const level2 = getRoleLevel(roleId2);
        return level1 > level2;
    };

    // 获取当前用户角色级别
    const getCurrentUserRoleLevel = () => {
        const currentRole = getCurrentUserRole();
        return currentRole?.level || 0;
    };

    // 检查当前用户是否可以管理指定角色
    const canManageRole = (targetRoleId: string) => {
        const currentLevel = getCurrentUserRoleLevel();
        const targetLevel = getRoleLevel(targetRoleId);
        return currentLevel > targetLevel;
    };

    // 获取可管理的角色列表
    const getManageableRoles = () => {
        const currentLevel = getCurrentUserRoleLevel();
        return appStore.getRoles().filter(role => role.level < currentLevel);
    };

    return {
        // 角色获取
        getAllRoles,
        getTaskAdminRoles,
        getTestPlatformAdminRoles,
        getRolesByLevel,
        getCurrentUserRole,
        getManageableRoles,

        // 权限检查
        hasPermission,
        roleHasPermission,
        canManageRole,

        // 角色信息
        getRoleDescription,
        getRolePermissions,
        getRoleLevel,
        getCurrentUserRoleLevel,

        // 角色比较
        isRoleHigherThan,

        // 角色设置
        setUserRole
    };
}; 