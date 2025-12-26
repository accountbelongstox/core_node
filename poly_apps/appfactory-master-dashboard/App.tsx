import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { CSDashboard } from './components/CSDashboard';
import { TechDashboard } from './components/TechDashboard';
import { AppAccessPage } from './components/AppAccessPage';
import { useApp } from './contexts/AppContext';
import { UserRole } from './types';

// Component to check if path is an encrypted string
const AppRouter: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check if current path is an encrypted string (APP access page)
  const isAppAccessPath = () => {
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
  const renderDashboard = () => {
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
  const { refreshKey } = useApp();

  return (
    <HashRouter key={refreshKey}>
      <Routes>
        <Route path="/*" element={<AppRouter />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
