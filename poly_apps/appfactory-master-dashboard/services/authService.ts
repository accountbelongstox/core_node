/**
 * 认证服务 - 内置管理账号系统
 * Uses multi-API system to get avatar URLs from laravel_main backend
 */
import { UserRole } from '../types';
import { UserInfo } from './storageService';
import { apiManager } from './ApiManager';
import { API_ENDPOINTS, buildApiUrl } from '../config/api-endpoints';

/**
 * Get avatar URL using multi-API system
 * Uses apiService to get absolute URL based on detected API endpoint
 * 
 * Note: We import apiManager and API_ENDPOINTS directly to avoid circular dependencies.
 * apiService imports constants, but authService doesn't import constants, so this is safe.
 */
const getAvatarUrl = (seed: string, size: number = 150, provider: string = 'pravatar'): string => {
  // Priority 1: Use current API endpoint from ApiManager (browser-detected)
  const currentBaseUrl = apiManager.getCurrentBaseUrl();
  if (currentBaseUrl) {
    return `${currentBaseUrl.replace(/\/$/, '')}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Priority 2: Use browser's current origin (ensures API is accessible from browser)
  // Note: This is a service class, not a React component, so direct window access is acceptable
  // For React components, use useOrigin() hook from OriginContext instead
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Priority 3: Fallback to first endpoint in config
  const fallbackUrl = API_ENDPOINTS.length > 0 ? buildApiUrl(API_ENDPOINTS[0]) : null;
  if (fallbackUrl) {
    return `${fallbackUrl.replace(/\/$/, '')}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Last resort: Use localhost (should never reach here in browser)
  return `http://localhost:9000/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
};

// 内置管理账号
// Type for builtin account (without 'as const' to allow dynamic account creation)
type BuiltinAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar: string;
};

export const BUILTIN_ACCOUNTS: Record<string, BuiltinAccount> = {
  admin: {
    id: 'admin-001',
    name: '系统管理员',
    email: 'admin@multichat.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    avatar: getAvatarUrl('admin', 150, 'pravatar'),
  },
  cs1: {
    id: 'cs-001',
    name: '客服代表1',
    email: 'cs1@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: getAvatarUrl('cs1', 150, 'pravatar'),
  },
  cs2: {
    id: 'cs-002',
    name: '客服代表2',
    email: 'cs2@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: getAvatarUrl('cs2', 150, 'pravatar'),
  },
  tech1: {
    id: 'tech-001',
    name: '技术工程师1',
    email: 'tech1@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: getAvatarUrl('tech1', 150, 'pravatar'),
  },
  tech2: {
    id: 'tech-002',
    name: '技术工程师2',
    email: 'tech2@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: getAvatarUrl('tech2', 150, 'pravatar'),
  },
  // 通用账号：用户名123，密码123，可以登录所有角色
  universal: {
    id: 'universal-001',
    name: '通用用户',
    email: '123',
    password: '123',
    role: UserRole.ADMIN, // 默认角色，但可以通过role参数切换
    avatar: getAvatarUrl('universal', 150, 'pravatar'),
  },
};

export interface LoginCredentials {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginResult {
  success: boolean;
  user?: UserInfo;
  token?: string;
  error?: string;
}

/**
 * 认证服务类
 */
class AuthService {
  /**
   * Built-in password for quick login
   */
  private readonly BUILTIN_PASSWORD = 'Gg88880000';

  /**
   * Login verification
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { email, password, role } = credentials;

    // Use built-in password if password is empty (quick login)
    const actualPassword = password !== null && password !== undefined && password !== '' ? password : this.BUILTIN_PASSWORD;

    // Find matching account - support both original password and built-in password
    let account = Object.values(BUILTIN_ACCOUNTS).find(
      (acc) => acc.email === email && (acc.password === actualPassword ? true : actualPassword === this.BUILTIN_PASSWORD)
    );

    // If it's a universal account (123/123 or 123 with built-in password), create corresponding user info based on selected role
    if (account === undefined && email === '123' && (actualPassword === '123' ? true : actualPassword === this.BUILTIN_PASSWORD)) {
      if (role) {
        // 根据选择的角色创建对应的用户信息，使用与BUILTIN_ACCOUNTS相同的名称
        const roleAccounts = {
          [UserRole.ADMIN]: {
            id: 'admin-universal',
            name: '系统管理员', // 与BUILTIN_ACCOUNTS.admin.name一致
            email: '123',
            password: '123',
            role: UserRole.ADMIN,
            avatar: getAvatarUrl('admin-universal', 150, 'pravatar'),
          },
          [UserRole.CS]: {
            id: 'cs-universal',
            name: '客服代表', // 与BUILTIN_ACCOUNTS.cs1.name风格一致
            email: '123',
            password: '123',
            role: UserRole.CS,
            avatar: getAvatarUrl('cs-universal', 150, 'pravatar'),
          },
          [UserRole.TECH]: {
            id: 'tech-universal',
            name: '技术工程师', // 与BUILTIN_ACCOUNTS.tech1.name风格一致
            email: '123',
            password: '123',
            role: UserRole.TECH,
            avatar: getAvatarUrl('tech-universal', 150, 'pravatar'),
          },
        };
        account = roleAccounts[role];
      } else {
        // 如果没有指定角色，默认使用管理员角色
        account = {
          id: 'admin-universal',
          name: '系统管理员', // 与BUILTIN_ACCOUNTS.admin.name一致
          email: '123',
          password: '123',
          role: UserRole.ADMIN,
          avatar: getAvatarUrl('admin-universal', 150, 'pravatar'),
        };
      }
    }

    if (!account) {
      return {
        success: false,
        error: '邮箱或密码错误',
      };
    }

    // If role is specified, use the specified role (for universal accounts)
    if (role !== null && role !== undefined && email === '123' && (actualPassword === '123' ? true : actualPassword === this.BUILTIN_PASSWORD)) {
      const roleAccounts = {
        [UserRole.ADMIN]: { ...account, id: 'admin-universal', name: '系统管理员', role: UserRole.ADMIN },
        [UserRole.CS]: { ...account, id: 'cs-universal', name: '客服代表', role: UserRole.CS },
        [UserRole.TECH]: { ...account, id: 'tech-universal', name: '技术工程师', role: UserRole.TECH },
      };
      account = roleAccounts[role];
    } else if (role && account.role !== role) {
      // 对于非通用账号，验证角色是否匹配
      return {
        success: false,
        error: '该账号不属于所选角色',
      };
    }

    // 生成 token（实际应用中应该由后端生成）
    const token = `token_${account.id}_${Date.now()}`;

    // Don't cache avatar URL - generate dynamically when needed
    // Extract seed from account ID for dynamic avatar generation
    const seed = account.id.replace('-001', '').replace('-universal', '-universal');

    const userInfo: UserInfo = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      // Store seed instead of URL for dynamic generation
      avatar: seed,
    };

    return {
      success: true,
      user: userInfo,
      token,
    };
  }

  /**
   * 验证 token
   */
  async verifyToken(token: string): Promise<boolean> {
    // 简单验证，实际应用中应该调用后端API
    return token.startsWith('token_');
  }

  /**
   * 获取所有内置账号（用于显示）
   */
  getBuiltinAccounts() {
    return Object.values(BUILTIN_ACCOUNTS);
  }

  /**
   * 根据角色获取账号
   */
  getAccountsByRole(role: UserRole) {
    return Object.values(BUILTIN_ACCOUNTS).filter((acc) => acc.role === role);
  }
}

// 导出单例
export const authService = new AuthService();

