/**
 * Authentication Service - Built-in Admin Account System
 * Uses multi-API system to get avatar URLs from laravel_main backend
 */
import { UserRole } from '../types';
import { UserInfo } from './storageService';
import { apiManager } from './ApiManager';
import { API_ENDPOINTS, buildApiUrl } from '../config/api-endpoints';
import { i18nService } from './i18nService';

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

// Built-in admin accounts
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
    name: 'System Administrator',
    email: 'admin@multichat.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    avatar: getAvatarUrl('admin', 150, 'pravatar'),
  },
  cs1: {
    id: 'cs-001',
    name: 'Customer Service Representative 1',
    email: 'cs1@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: getAvatarUrl('cs1', 150, 'pravatar'),
  },
  cs2: {
    id: 'cs-002',
    name: 'Customer Service Representative 2',
    email: 'cs2@multichat.com',
    password: 'cs123',
    role: UserRole.CS,
    avatar: getAvatarUrl('cs2', 150, 'pravatar'),
  },
  tech1: {
    id: 'tech-001',
    name: 'Technical Engineer 1',
    email: 'tech1@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: getAvatarUrl('tech1', 150, 'pravatar'),
  },
  tech2: {
    id: 'tech-002',
    name: 'Technical Engineer 2',
    email: 'tech2@multichat.com',
    password: 'tech123',
    role: UserRole.TECH,
    avatar: getAvatarUrl('tech2', 150, 'pravatar'),
  },
  // Universal account: username 123, password 123, can login with all roles
  universal: {
    id: 'universal-001',
    name: 'Universal User',
    email: '123',
    password: '123',
    role: UserRole.ADMIN, // Default role, but can be switched via role parameter
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
 * Authentication Service Class
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
        // Create corresponding user info based on selected role, using same names as BUILTIN_ACCOUNTS
        const roleAccounts = {
          [UserRole.ADMIN]: {
            id: 'admin-universal',
            name: 'System Administrator', // Consistent with BUILTIN_ACCOUNTS.admin.name
            email: '123',
            password: '123',
            role: UserRole.ADMIN,
            avatar: getAvatarUrl('admin-universal', 150, 'pravatar'),
          },
          [UserRole.CS]: {
            id: 'cs-universal',
            name: 'Customer Service Representative', // Consistent with BUILTIN_ACCOUNTS.cs1.name style
            email: '123',
            password: '123',
            role: UserRole.CS,
            avatar: getAvatarUrl('cs-universal', 150, 'pravatar'),
          },
          [UserRole.TECH]: {
            id: 'tech-universal',
            name: 'Technical Engineer', // Consistent with BUILTIN_ACCOUNTS.tech1.name style
            email: '123',
            password: '123',
            role: UserRole.TECH,
            avatar: getAvatarUrl('tech-universal', 150, 'pravatar'),
          },
        };
        account = roleAccounts[role];
      } else {
        // If no role specified, default to admin role
        account = {
          id: 'admin-universal',
          name: 'System Administrator', // Consistent with BUILTIN_ACCOUNTS.admin.name
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
        error: i18nService.t('login.invalidCredentials'),
      };
    }

    // If role is specified, use the specified role (for universal accounts)
    if (role !== null && role !== undefined && email === '123' && (actualPassword === '123' ? true : actualPassword === this.BUILTIN_PASSWORD)) {
      const roleAccounts = {
        [UserRole.ADMIN]: { ...account, id: 'admin-universal', name: 'System Administrator', role: UserRole.ADMIN },
        [UserRole.CS]: { ...account, id: 'cs-universal', name: 'Customer Service Representative', role: UserRole.CS },
        [UserRole.TECH]: { ...account, id: 'tech-universal', name: 'Technical Engineer', role: UserRole.TECH },
      };
      account = roleAccounts[role];
    } else if (role && account.role !== role) {
      // For non-universal accounts, verify role matches
      return {
        success: false,
        error: i18nService.t('login.roleMismatch'),
      };
    }

    // Generate token (in real application, this should be generated by backend)
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
   * Verify token
   */
  async verifyToken(token: string): Promise<boolean> {
    // Simple verification, in real application should call backend API
    return token.startsWith('token_');
  }

  /**
   * Get all built-in accounts (for display)
   */
  getBuiltinAccounts() {
    return Object.values(BUILTIN_ACCOUNTS);
  }

  /**
   * Get accounts by role
   */
  getAccountsByRole(role: UserRole) {
    return Object.values(BUILTIN_ACCOUNTS).filter((acc) => acc.role === role);
  }
}

// Export singleton
export const authService = new AuthService();

