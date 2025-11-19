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

import { defineStore } from 'pinia';
import appSetting from '@/app-setting';

// 角色类型定义
export interface Role {
    id: string;
    name: string;
    level: number;
    description: string;
    permissions: string[];
}

// 应用配置
export const APP_CONFIG = {
    name: 'VRISTO Dashboard',
    version: '1.0.0',
    description: 'Modern Admin Dashboard Template',
    company: 'VRISTO',
    supportEmail: 'support@vristo.com',
    website: 'https://vristo.com'
};

// 角色配置
export const ROLES_CONFIG: Role[] = [
    // 任务管理员 1-10级
    { id: 'task_admin_1', name: 'Task Administrator Level 1', level: 1, description: 'Basic task management permissions', permissions: ['view_tasks', 'create_tasks'] },
    { id: 'task_admin_2', name: 'Task Administrator Level 2', level: 2, description: 'Enhanced task management with approval', permissions: ['view_tasks', 'create_tasks', 'approve_tasks'] },
    { id: 'task_admin_3', name: 'Task Administrator Level 3', level: 3, description: 'Team lead task management', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks'] },
    { id: 'task_admin_4', name: 'Task Administrator Level 4', level: 4, description: 'Department task oversight', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks'] },
    { id: 'task_admin_5', name: 'Task Administrator Level 5', level: 5, description: 'Senior task management', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams'] },
    { id: 'task_admin_6', name: 'Task Administrator Level 6', level: 6, description: 'Project level task management', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams', 'manage_projects'] },
    { id: 'task_admin_7', name: 'Task Administrator Level 7', level: 7, description: 'Program level task oversight', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams', 'manage_projects', 'manage_programs'] },
    { id: 'task_admin_8', name: 'Task Administrator Level 8', level: 8, description: 'Division level task management', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams', 'manage_projects', 'manage_programs', 'manage_divisions'] },
    { id: 'task_admin_9', name: 'Task Administrator Level 9', level: 9, description: 'Executive task oversight', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams', 'manage_projects', 'manage_programs', 'manage_divisions', 'manage_executives'] },
    { id: 'task_admin_10', name: 'Task Administrator Level 10', level: 10, description: 'Chief task administrator', permissions: ['view_tasks', 'create_tasks', 'approve_tasks', 'assign_tasks', 'delete_tasks', 'manage_teams', 'manage_projects', 'manage_programs', 'manage_divisions', 'manage_executives', 'manage_all'] },
    
    // 测试平台管理员
    { id: 'test_platform_admin', name: 'Test Platform Administrator', level: 5, description: 'Full access to testing platform and tools', permissions: ['view_tests', 'create_tests', 'run_tests', 'manage_test_environment', 'view_reports', 'manage_users'] },
    
    // 系统管理员
    { id: 'system_admin', name: 'System Administrator', level: 10, description: 'Full system access and configuration', permissions: ['*'] },
    
    // 普通用户
    { id: 'user', name: 'Regular User', level: 1, description: 'Basic user access', permissions: ['view_dashboard', 'view_profile'] }
];

export const useAppStore = defineStore('app', {
    state: () => ({
        // 应用配置
        appConfig: APP_CONFIG,
        roles: ROLES_CONFIG,
        
        // 当前用户信息
        currentUser: {
            id: null,
            email: '',
            name: '',
            role: null as Role | null,
            avatar: '',
            isAuthenticated: false
        },
        
        // 主题和UI状态
        isDarkMode: false,
        mainLayout: 'app',
        theme: 'light',
        menu: 'vertical',
        layout: 'full',
        rtlClass: 'ltr',
        animation: '',
        navbar: 'navbar-sticky',
        locale: 'en',
        sidebar: false,
        languageList: [
            { code: 'zh', name: 'Chinese' },
            { code: 'da', name: 'Danish' },
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'el', name: 'Greek' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'it', name: 'Italian' },
            { code: 'ja', name: 'Japanese' },
            { code: 'pl', name: 'Polish' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'es', name: 'Spanish' },
            { code: 'sv', name: 'Swedish' },
            { code: 'tr', name: 'Turkish' },
        ],
        isShowMainLoader: true,
        semidark: false,
    }),

    actions: {
        // 用户认证相关
        setCurrentUser(user: any) {
            this.currentUser = {
                ...this.currentUser,
                ...user,
                isAuthenticated: true
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        },
        
        setUserRole(roleId: string) {
            const role = this.roles.find(r => r.id === roleId);
            if (role) {
                this.currentUser.role = role;
                localStorage.setItem('userRole', roleId);
            }
        },
        
        logout() {
            this.currentUser = {
                id: null,
                email: '',
                name: '',
                role: null,
                avatar: '',
                isAuthenticated: false
            };
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userRole');
        },
        
        // 权限检查
        hasPermission(permission: string): boolean {
            if (!this.currentUser.role) return false;
            return this.currentUser.role.permissions.includes('*') || 
                   this.currentUser.role.permissions.includes(permission);
        },
        
        // 获取用户角色
        getUserRole(): Role | null {
            return this.currentUser.role;
        },
        
        // 获取所有角色
        getRoles(): Role[] {
            return this.roles;
        },
        
        // 根据级别获取角色
        getRolesByLevel(minLevel: number = 1, maxLevel: number = 10): Role[] {
            return this.roles.filter(role => role.level >= minLevel && role.level <= maxLevel);
        },
        
        // 获取任务管理员角色
        getTaskAdminRoles(): Role[] {
            return this.roles.filter(role => role.id.startsWith('task_admin_'));
        },
        
        // 获取测试平台管理员角色
        getTestPlatformAdminRoles(): Role[] {
            return this.roles.filter(role => role.id === 'test_platform_admin');
        },

        // 原有的UI状态管理方法
        setMainLayout(payload: any = null) {
            this.mainLayout = payload; //app , auth
        },
        toggleTheme(payload: any = null) {
            payload = payload || this.theme; // light|dark|system
            localStorage.setItem('theme', payload);
            this.theme = payload;
            if (payload == 'light') {
                this.isDarkMode = false;
            } else if (payload == 'dark') {
                this.isDarkMode = true;
            } else if (payload == 'system') {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    this.isDarkMode = true;
                } else {
                    this.isDarkMode = false;
                }
            }

            if (this.isDarkMode) {
                document.querySelector('body')?.classList.add('dark');
            } else {
                document.querySelector('body')?.classList.remove('dark');
            }
        },
        toggleMenu(payload: any = null) {
            payload = payload || this.menu; // vertical, collapsible-vertical, horizontal
            this.sidebar = false; // reset sidebar state
            localStorage.setItem('menu', payload);
            this.menu = payload;
        },
        toggleLayout(payload: any = null) {
            payload = payload || this.layout; // full, boxed-layout
            localStorage.setItem('layout', payload);
            this.layout = payload;
        },
        toggleRTL(payload: any = null) {
            payload = payload || this.rtlClass; // rtl, ltr
            localStorage.setItem('rtlClass', payload);
            this.rtlClass = payload;
            document.querySelector('html')?.setAttribute('dir', this.rtlClass || 'ltr');
        },
        toggleAnimation(payload: any = null) {
            payload = payload || this.animation; // animate__fadeIn, animate__fadeInDown, animate__fadeInUp, animate__fadeInLeft, animate__fadeInRight, animate__slideInDown, animate__slideInLeft, animate__slideInRight, animate__zoomIn
            payload = payload?.trim();
            localStorage.setItem('animation', payload);
            this.animation = payload;
            appSetting.changeAnimation();
        },
        toggleNavbar(payload: any = null) {
            payload = payload || this.navbar; // navbar-sticky, navbar-floating, navbar-static
            localStorage.setItem('navbar', payload);
            this.navbar = payload;
        },
        toggleSemidark(payload: any = null) {
            payload = payload || false;
            localStorage.setItem('semidark', payload);
            this.semidark = payload;
        },
        toggleLocale(payload: any = null, setLocale: any) {
            payload = payload || this.locale;
            localStorage.setItem('i18n_locale', payload);
            this.locale = payload;
            setLocale(payload);
        },
        toggleSidebar(state: boolean = false) {
            this.sidebar = !this.sidebar;
        },
        toggleMainLoader(state: boolean = false) {
            this.isShowMainLoader = true;
            setTimeout(() => {
                this.isShowMainLoader = false;
            }, 500);
        },
    },
    getters: {
        // 获取应用名称
        appName: (state) => state.appConfig.name,
        
        // 获取当前用户是否已认证
        isAuthenticated: (state) => state.currentUser.isAuthenticated,
        
        // 获取当前用户角色
        currentUserRole: (state) => state.currentUser.role,
        
        // 获取当前用户权限
        currentUserPermissions: (state) => state.currentUser.role?.permissions || [],
    },
});
