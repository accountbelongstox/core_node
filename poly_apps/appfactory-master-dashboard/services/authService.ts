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
  // 通用账号：用户名123，密码123，可以登录所有角色
  universal: {
    id: 'universal-001',
    name: '通用用户',
    email: '123',
    password: '123',
    role: UserRole.ADMIN, // 默认角色，但可以通过role参数切换
    avatar: 'https://i.pravatar.cc/150?u=universal',
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
    let account = Object.values(BUILTIN_ACCOUNTS).find(
      (acc) => acc.email === email && acc.password === password
    );

    // 如果是通用账号（123/123），根据选择的角色创建对应的用户信息
    if (!account && email === '123' && password === '123') {
      if (role) {
        // 根据选择的角色创建对应的用户信息
        const roleAccounts = {
          [UserRole.ADMIN]: {
            id: 'admin-universal',
            name: '管理员',
            email: '123',
            password: '123',
            role: UserRole.ADMIN,
            avatar: 'https://i.pravatar.cc/150?u=admin-universal',
          },
          [UserRole.CS]: {
            id: 'cs-universal',
            name: '推广人员',
            email: '123',
            password: '123',
            role: UserRole.CS,
            avatar: 'https://i.pravatar.cc/150?u=cs-universal',
          },
          [UserRole.TECH]: {
            id: 'tech-universal',
            name: '技术工程师',
            email: '123',
            password: '123',
            role: UserRole.TECH,
            avatar: 'https://i.pravatar.cc/150?u=tech-universal',
          },
        };
        account = roleAccounts[role];
      } else {
        // 如果没有指定角色，默认使用管理员角色
        account = {
          id: 'admin-universal',
          name: '管理员',
          email: '123',
          password: '123',
          role: UserRole.ADMIN,
          avatar: 'https://i.pravatar.cc/150?u=admin-universal',
        };
      }
    }

    if (!account) {
      return {
        success: false,
        error: '邮箱或密码错误',
      };
    }

    // 如果指定了角色，使用指定的角色（对于通用账号）
    if (role && email === '123' && password === '123') {
      const roleAccounts = {
        [UserRole.ADMIN]: { ...account, id: 'admin-universal', name: '管理员', role: UserRole.ADMIN },
        [UserRole.CS]: { ...account, id: 'cs-universal', name: '推广人员', role: UserRole.CS },
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

