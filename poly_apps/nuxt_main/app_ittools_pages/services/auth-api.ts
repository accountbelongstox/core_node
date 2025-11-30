/**
 * IT Tools Authentication API Service
 */

import { apiEndpointsHelper } from '@/common/utils/api-endpoints-helper';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface User {
  id: string | number;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
    refreshToken?: string;
  };
  error?: string;
}

/**
 * Create auth headers
 */
function createAuthHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-App-Namespace': 'ittools'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * User login
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const baseUrl = apiEndpointsHelper.getActiveBaseUrl();

  if (!baseUrl) {
    return {
      success: false,
      error: 'No active API endpoint available'
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`
      };
    }

    return {
      success: true,
      data: data.data || data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    };
  }
}

/**
 * User registration
 */
export async function register(registerData: RegisterData): Promise<AuthResponse> {
  const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
  

  if (!baseUrl) {
    return {
      success: false,
      error: 'No active API endpoint available'
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(registerData)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`
      };
    }

    return {
      success: true,
      data: data.data || data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(token: string): Promise<AuthResponse> {
  const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
  

  if (!baseUrl) {
    return {
      success: false,
      error: 'No active API endpoint available'
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/user`, {
      method: 'GET',
      headers: createAuthHeaders(token)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`
      };
    }

    return {
      success: true,
      data: {
        user: data.data || data,
        token
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user info'
    };
  }
}

/**
 * User logout
 */
export async function logout(token: string): Promise<AuthResponse> {
  const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
  

  if (!baseUrl) {
    return {
      success: false,
      error: 'No active API endpoint available'
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/logout`, {
      method: 'POST',
      headers: createAuthHeaders(token)
    });

    const data = await response.json();

    return {
      success: response.ok,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed'
    };
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const baseUrl = apiEndpointsHelper.getActiveBaseUrl();
  

  if (!baseUrl) {
    return {
      success: false,
      error: 'No active API endpoint available'
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/refresh`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`
      };
    }

    return {
      success: true,
      data: data.data || data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed'
    };
  }
}
