/**
 * 认证服务 - 内置管理账号系统
 */
import { UserRole } from '../types';
import { UserInfo } from './storageService';

// 内置管理账号
export const BUILTIN_ACCOUNTS = {
  admin: {
    id: 'admin-001',
    name: '系统管理员',
    email: 'admin@multichat.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    avatar: 'https://i.pravatar.cc/150?u=admin',
  },
  cs1: {
    id: 'cs-001',
    name: '客服代表1',
    email: 'cs1@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: 'https://i.pravatar.cc/150?u=cs1',
  },
  cs2: {
    id: 'cs-002',
    name: '客服代表2',
    email: 'cs2@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: 'https://i.pravatar.cc/150?u=cs2',
  },
  tech1: {
    id: 'tech-001',
    name: '技术工程师1',
    email: 'tech1@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: 'https://i.pravatar.cc/150?u=tech1',
  },
  tech2: {
    id: 'tech-002',
    name: '技术工程师2',
    email: 'tech2@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: 'https://i.pravatar.cc/150?u=tech2',
  },
} as const;

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
   * 登录验证
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { email, password, role } = credentials;

    // 查找匹配的账号
    const account = Object.values(BUILTIN_ACCOUNTS).find(
      (acc) => acc.email === email && acc.password === password
    );

    if (!account) {
      return {
        success: false,
        error: '邮箱或密码错误',
      };
    }

    // 如果指定了角色，验证角色是否匹配
    if (role && account.role !== role) {
      return {
        success: false,
        error: '该账号不属于所选角色',
      };
    }

    // 生成 token（实际应用中应该由后端生成）
    const token = `token_${account.id}_${Date.now()}`;

    const userInfo: UserInfo = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      avatar: account.avatar,
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

