import React from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Cpu, 
  UploadCloud, 
  Globe, 
  FileText, 
  Wrench, 
  Settings as SettingsIcon,
  ChevronRight,
  LogOut,
  BarChart2
} from 'lucide-react';
import { ViewState } from '../types';
import { useApp } from '../contexts/AppContext';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const { t } = useApp();

  const menuItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { 
      label: t('nav.system'), 
      icon: Server,
      children: [
        { id: 'system_status', label: t('nav.system.status') },
        { id: 'system_config', label: t('nav.system.config') },
      ]
    },
    {
      label: t('nav.local'),
      icon: Cpu,
      children: [
        { id: 'local_capabilities', label: t('nav.local.cap') },
        { id: 'local_config', label: t('nav.local.conf') },
<<<<<<< HEAD
        { id: 'local_stats', label: t('nav.local.stats') },
        { id: 'local_test', label: t('nav.local.test') },
=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
      ]
    },
    { id: 'upload_tasks', label: t('nav.uploads'), icon: UploadCloud },
    { id: 'remote_servers', label: t('nav.remote'), icon: Globe },
    { id: 'statistics', label: t('nav.statistics'), icon: BarChart2 },
    { id: 'logs', label: t('nav.logs'), icon: FileText },
    { id: 'tools', label: t('nav.tools'), icon: Wrench },
  ];

  return (
    <aside className="w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 h-screen flex-shrink-0 flex flex-col transition-colors duration-200 border-r border-slate-800 dark:border-slate-800">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800 dark:border-slate-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-blue-900/50 shadow-lg">
          P
        </div>
        <span className="font-bold text-white text-lg tracking-tight">Pycore</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, idx) => {
            if (item.children) {
              return (
                <li key={idx} className="mb-2">
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  <ul className="pl-9 space-y-1 mt-1">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <button
                          onClick={() => onChangeView(child.id as ViewState)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            currentView === child.id 
                              ? 'bg-blue-600 text-white' 
                              : 'hover:bg-slate-800 hover:text-white text-slate-400'
                          }`}
                        >
                          {child.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <button
                  onClick={() => onChangeView(item.id as ViewState)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors mb-1 ${
                    currentView === item.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {currentView === item.id && <ChevronRight size={14} className="ml-auto" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
         <button 
            onClick={() => onChangeView('settings')}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors ${
              currentView === 'settings' 
              ? 'bg-slate-800 text-white' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
         >
            <SettingsIcon size={18} />
            <span>{t('nav.settings')}</span>
         </button>
      </div>
    </aside>
  );
};

export default Sidebar;