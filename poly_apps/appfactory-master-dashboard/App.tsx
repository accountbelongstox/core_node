import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { CSDashboard } from './components/CSDashboard';
import { TechDashboard } from './components/TechDashboard';
import { AppAccessPage } from './components/AppAccessPage';
import { useApp } from './contexts/AppContext';
import { PasswordProvider } from './contexts/PasswordContext';
import { ApiHealthCheckProvider } from './contexts/ApiHealthCheckContext';
import { OriginProvider } from './contexts/OriginContext';
import { UserRole } from './types';
import { authService } from './services/authService';
// Removed extractPathFromHash and getUrlParamOrNull - using BrowserRouter's location.search instead
import { useAutoPassword } from './hooks/useAutoPassword';

// Component to check if path is an encrypted string
const AppRouter: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, login, t } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState<string | null>(null); // Track attempted user
  
  // Automatically add password parameter to all routes
  // Uses React Router hooks - no manual window.location manipulation needed
  useAutoPassword();

  // Check for URL parameters and auto-login
  // Use BrowserRouter's location.search instead of hash
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const debugUser = searchParams.get('user');
    const debugPwd = searchParams.get('pwd') ?? searchParams.get('password');
    const debugRole = searchParams.get('role');

    // If URL has login parameters, prioritize URL login over localStorage cache
    // This ensures URL parameters always work, even if user was previously logged in
    if (debugUser) {
      // Create a unique key for this login attempt (user+role)
      const loginKey = `${debugUser}:${debugRole ?? 'default'}`;
      
      // If we already attempted this exact login, skip to avoid infinite loops
      if (autoLoginAttempted === loginKey) {
        return;
      }
      
      // Mark this login attempt
      setAutoLoginAttempted(loginKey);
    } else {
      // No login params in URL, respect existing authentication state
      return;
    }

    const roleMap: Record<string, UserRole> = {
      'admin': UserRole.ADMIN,
      'cs': UserRole.CS,
      'tech': UserRole.TECH,
    };
    const loginRole = debugRole ? (roleMap[debugRole.toLowerCase()] ?? UserRole.ADMIN) : UserRole.ADMIN;

    // Use the exact same login logic as Login component
    // Built-in password for quick login (same as Login.tsx line 123)
    const BUILTIN_PASSWORD = 'Gg88880000';
    // Same logic as Login.tsx line 40: Use built-in password if password field is empty
    const loginPassword = debugPwd ?? BUILTIN_PASSWORD;

    // Same authService.login call as Login.tsx lines 42-46
    authService.login({
      email: debugUser,
      password: loginPassword,
      role: loginRole,
    }).then((result) => {
      // Same success handling as Login.tsx lines 48-101
      if (result.success && result.user && result.token) {
        // Use the same login function as Login component (line 100)
        // No delay needed for auto-login (Login component delays 800ms for toast)
        login(result.user, result.token);
        
        // After login, navigate to root path (/) to match Login component behavior
        // Login component doesn't navigate, so it stays at current path
        // But when URL has login params, we should navigate to root to show overview
        // This matches the behavior when manually logging in from root URL
        const currentPath = location.pathname || '/';
        
        // If URL contains login parameters, navigate to root after login
        // This ensures auto-login shows the same page as manual login (overview)
        if (debugUser ?? debugPwd ?? debugRole) {
          // Remove login parameters from URL and navigate to root
          navigate('/', { replace: true });
        }
      } else {
        // Same error handling as Login.tsx lines 102-109
        const errorMessage = result.error ?? t('login.loginFailed');
        console.error('[AUTO LOGIN] Failed to login:', errorMessage);
        // Reset autoLoginAttempted to allow retry
        setAutoLoginAttempted(null);
      }
    }).catch((err: unknown) => {
      // Same error handling as Login.tsx lines 110-116
      const errorMessage = err instanceof Error ? err.message : t('login.loginFailed');
      console.error('[AUTO LOGIN] Error during login:', errorMessage);
      // Reset autoLoginAttempted to allow retry
      setAutoLoginAttempted(null);
    });
  }, [autoLoginAttempted, login, t, navigate]);

  // Check if current path is an encrypted string (APP access page)
  const isAppAccessPath = (): boolean => {
    const path = location.pathname;
    if (!path || path === '/') return false;
    // Check if path looks like an encrypted string (20+ chars, alphanumeric + - _)
    // and is not a known dashboard route
    const knownRoutes = [
      'apps', 'cs', 'release', 'queue', 'projects', 'promotion-tracks',
      'build', 'bugs', 'monitoring', 'app-releases', 'profile', 'notifications',
      'my-apps', 'promotions', 'performance', 'analytics', 'cs-assignment', 'revenue'
    ];
    return /^[A-Za-z0-9_-]{20,}$/.test(path) && !knownRoutes.some(route => path.startsWith(route));
  };

  // Render dashboard based on user role
  const renderDashboard = (): React.ReactElement => {
    switch (user?.role) {
      case UserRole.ADMIN:
        return <AdminDashboard onOpenSettings={() => setIsSettingsOpen(true)} />;
      case UserRole.CS:
        return <CSDashboard onOpenSettings={() => setIsSettingsOpen(true)} />;
      case UserRole.TECH:
        return <TechDashboard onOpenSettings={() => setIsSettingsOpen(true)} />;
      default:
        return <AdminDashboard onOpenSettings={() => setIsSettingsOpen(true)} />;
    }
  };

  // If path is an encrypted string, show APP access page (no login required)
  if (isAppAccessPath()) {
    return <AppAccessPage />;
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show dashboard for authenticated users
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 transition-colors">
      {renderDashboard()}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <OriginProvider>
        <PasswordProvider>
          <ApiHealthCheckProvider>
            <Routes>
              <Route path="/*" element={<AppRouter />} />
            </Routes>
          </ApiHealthCheckProvider>
        </PasswordProvider>
      </OriginProvider>
    </BrowserRouter>
  );
};

export default App;
