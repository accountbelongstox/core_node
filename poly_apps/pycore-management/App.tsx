import React, { useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SystemManagement from './pages/SystemManagement';
import LocalProcessing from './pages/LocalProcessing';
import UploadTasks from './pages/UploadTasks';
import RemoteServers from './pages/RemoteServers';
import Logs from './pages/Logs';
import Tools from './pages/Tools';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import { ViewState } from './types';
import { Bell, Search } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const { t } = useApp();

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'system_status':
      case 'system_config':
        return <SystemManagement defaultTab={currentView === 'system_config' ? 'config' : 'status'} />;
      case 'local_capabilities':
      case 'local_config':
        return <LocalProcessing defaultTab={currentView === 'local_config' ? 'config' : 'status'} />;
      case 'upload_tasks':
        return <UploadTasks />;
      case 'remote_servers':
        return <RemoteServers />;
      case 'statistics':
        return <Statistics />;
      case 'logs':
        return <Logs />;
      case 'tools':
        return <Tools />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
             <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                <Search size={48} />
             </div>
             <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-400">Under Construction</h2>
             <p>{t('common.loading')}</p>
          </div>
        );
    }
  };

  const getPageTitle = (view: ViewState) => {
    switch(view) {
      case 'dashboard': return t('nav.dashboard');
      case 'system_status': return t('nav.system.status');
      case 'system_config': return t('nav.system.config');
      case 'local_capabilities': return t('nav.local.cap');
      case 'local_config': return t('nav.local.conf');
      case 'upload_tasks': return t('nav.uploads');
      case 'remote_servers': return t('nav.remote');
      case 'statistics': return t('nav.statistics');
      case 'logs': return t('nav.logs');
      case 'tools': return t('nav.tools');
      case 'settings': return t('nav.settings');
      default: return (view as string).replace('_', ' ');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-200">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 capitalize">
                {getPageTitle(currentView)}
             </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                    A
                </div>
                <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Admin User</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">System Operator</div>
                </div>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;