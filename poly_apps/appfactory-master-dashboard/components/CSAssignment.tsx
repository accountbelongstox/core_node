import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Users, DollarSign, TrendingUp } from 'lucide-react';
import { AppInstance, CustomerService, AppStatus } from '../types';
import { modelService } from '../services/modelService';
import { useApp } from '../contexts/AppContext';

export const CSAssignment: React.FC = () => {
  const { t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppInstance | null>(null);
  const [selectedCS, setSelectedCS] = useState<CustomerService[]>([]);

  const apps = useMemo(() => modelService.getApps() || [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() || [], []);

  const filteredApps = useMemo(() => {
    return apps.filter(app =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [apps, searchTerm]);

  const availableCS = useMemo(() => {
    if (!selectedApp) return csTeam;
    return csTeam.filter(cs => !selectedApp.assignedCSIds.includes(cs.id));
  }, [csTeam, selectedApp]);

  const handleSelectApp = (app: AppInstance) => {
    setSelectedApp(app);
    setSelectedCS(csTeam.filter(cs => app.assignedCSIds.includes(cs.id)));
  };

  const handleAddCS = (cs: CustomerService) => {
    if (selectedApp && !selectedCS.find(c => c.id === cs.id)) {
      setSelectedCS([...selectedCS, cs]);
    }
  };

  const handleRemoveCS = (csId: string) => {
    setSelectedCS(selectedCS.filter(cs => cs.id !== csId));
  };

  const handleSaveAssignment = () => {
    if (selectedApp) {
      console.log('Saving assignment:', {
        appId: selectedApp.id,
        csIds: selectedCS.map(cs => cs.id)
      });
      alert('Assignment saved! (This is a demo)');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('csAssignment.title')}</h2>
        {selectedApp && (
          <button
            onClick={handleSaveAssignment}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('csAssignment.saveAssignment')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={t('csAssignment.searchApps')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => handleSelectApp(app)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedApp?.id === app.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                      : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-slate-800 dark:text-white">{app.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      app.status === AppStatus.LIVE ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      app.status === AppStatus.PENDING ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{app.category}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <span>{app.assignedCSIds.length} CS assigned</span>
                    <span>${app.revenue.toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedApp ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{selectedApp.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{selectedApp.description}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revenue</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">${selectedApp.revenue.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Visits</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedApp.visits.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">DAU</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedApp.dailyActiveUsers.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Users size={20} />
                    {t('csAssignment.assignedCS')} ({selectedCS.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedCS.length > 0 ? (
                      selectedCS.map(cs => (
                        <div key={cs.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <img src={cs.avatar} alt={cs.name} className="w-10 h-10 rounded-full" />
                            <div>
                              <p className="font-medium text-slate-800 dark:text-white">{cs.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Rate: {cs.commissionRate}%</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveCS(cs.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-center py-4">{t('csAssignment.noCSAssigned')}</p>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Plus size={20} />
                    {t('csAssignment.availableCS')}
                  </h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {availableCS.map(cs => (
                      <button
                        key={cs.id}
                        onClick={() => handleAddCS(cs)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img src={cs.avatar} alt={cs.name} className="w-10 h-10 rounded-full" />
                          <div className="text-left">
                            <p className="font-medium text-slate-800 dark:text-white">{cs.name}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span>Rate: {cs.commissionRate}%</span>
                              <span className={`px-2 py-0.5 rounded-full ${
                                cs.status === 'Online' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
                              }`}>
                                {cs.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white">${cs.totalEarnings.toLocaleString()}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cs.assignedAppIds.length} apps</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 flex flex-col items-center justify-center min-h-[400px]">
              <Users size={48} className="text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-center">
                {t('csAssignment.selectApp')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

