
import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { CSDashboard } from './components/CSDashboard';
import { TechDashboard } from './components/TechDashboard';
import { useApp } from './contexts/AppContext';
import { UserRole } from './types';

const App: React.FC = () => {
  const { isAuthenticated, user } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <Login />;
  }

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

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 transition-colors">
        {renderDashboard()}
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </HashRouter>
  );
};

export default App;
