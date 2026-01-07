import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../App';
import { Icons } from '../constants';
import { SystemStatus } from '../types';
import UptimeBar from '../components/UptimeBar';
import ModelStatusCard from '../components/ModelStatusCard';

const AvailabilityStatusPage: React.FC = () => {
  const { t, state, stateCenter } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'operational' | 'degraded' | 'offline'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Get availability data from state center
  const availabilityData = state.availabilityData.length > 0 
    ? state.availabilityData 
    : stateCenter.getAvailability();
  
  const lastUpdated = new Date(state.lastAvailabilityUpdate || Date.now());

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      stateCenter.refreshAvailability();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, stateCenter]);

  // Filter services based on search and status
  const filteredServices = useMemo(() => {
    return availabilityData.filter((service) => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'operational' && service.status === 'operational') ||
        (statusFilter === 'degraded' && service.status === 'degraded') ||
        (statusFilter === 'offline' && service.status !== 'operational' && service.status !== 'degraded');
      
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, availabilityData]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: t.availabilityStatusTitle,
        text: t.availabilityStatusDescription,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // TODO: Show toast notification
    }
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}${t.secondsAgo || 's ago'}`;
    if (diff < 3600) return `${Math.floor(diff / 60)}${t.minutesAgo || 'm ago'}`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen p-6 sm:p-12 md:p-24">
      <div className="max-w-[1700px] mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
            <div>
              <h1 className="text-6xl font-black mb-4 tracking-tighter italic">{t.availabilityStatusTitle}</h1>
              <p className="dark:text-slate-400 text-slate-500 text-xl font-medium">{t.availabilityStatusDescription}</p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-wider bg-slate-500/5 hover:bg-blue-600/15 transition-all shadow-lg flex items-center gap-2"
              >
                {autoRefresh ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    {t.autoRefresh}
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                    {t.pauseRefresh}
                  </>
                )}
              </button>
              
              <button
                onClick={handleShare}
                className="px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-wider bg-slate-500/5 hover:bg-blue-600/15 transition-all shadow-lg"
              >
                {t.share}
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-blue-500">
                  <Icons.Activity />
                </div>
                <input
                  type="text"
                  placeholder={t.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-500/5 dark:bg-white/5 border dark:border-white/10 border-slate-200 rounded-[1.5rem] py-4 pl-14 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                {(['all', 'operational', 'degraded', 'offline'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-6 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-wider transition-all ${
                      statusFilter === filter
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-slate-500/5 dark:text-slate-400 text-slate-600 hover:bg-blue-600/10'
                    }`}
                  >
                    {filter === 'all' ? t.allServices : t[filter]}
                  </button>
                ))}
              </div>
            </div>

            {/* Last Updated */}
            <div className="mt-4 text-xs font-black text-slate-500 uppercase tracking-widest">
              {t.lastUpdated}: {formatLastUpdated(lastUpdated)}
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-2">{t.allServices}</div>
            <div className="text-3xl font-black tracking-tighter italic">{availabilityData.length}</div>
          </div>
          <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-2">{t.operational}</div>
            <div className="text-3xl font-black tracking-tighter italic text-green-500">
              {availabilityData.filter(s => s.status === 'operational').length}
            </div>
          </div>
          <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-2">{t.degraded}</div>
            <div className="text-3xl font-black tracking-tighter italic text-yellow-500">
              {availabilityData.filter(s => s.status === 'degraded').length}
            </div>
          </div>
          <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-2">{t.compositeUptime}</div>
            <div className="text-3xl font-black tracking-tighter italic text-blue-500">
              {availabilityData.length > 0 
                ? ((availabilityData.reduce((sum, s) => sum + s.uptime, 0) / availabilityData.length)).toFixed(2)
                : '0.00'}%
            </div>
          </div>
        </div>

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="glass p-20 rounded-[4rem] border-white/5 shadow-2xl text-center">
            <div className="text-2xl font-black mb-4 text-slate-500">{t.noServicesFound}</div>
            <p className="text-sm text-slate-400">{t.search} {t.filter}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredServices.map((service, idx) => (
              <div
                key={idx}
                className="glass p-8 rounded-[3rem] border-white/5 hover:border-blue-500/30 transition-all shadow-xl group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full shadow-lg ${
                      service.status === 'operational' 
                        ? 'bg-green-500 animate-pulse' 
                        : service.status === 'degraded'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="text-xl font-black italic tracking-tight group-hover:text-blue-500 transition-colors">
                        {service.name}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase italic tracking-widest">
                        {service.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.currentLatency}</span>
                    <span className="text-lg font-black italic text-blue-500 tabular-nums">{service.latency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.serviceUptime}</span>
                    <span className="text-lg font-black italic text-green-500 tabular-nums">{service.uptime}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">
                    {t.historicalMatrix}
                  </div>
                  <UptimeBar history={service.history} size="h-6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detailed View */}
        <div className="glass p-12 rounded-[4rem] border-white/5 relative overflow-hidden shadow-2xl bg-gradient-to-br from-green-500/5 to-transparent">
          <div className="absolute top-0 right-0 p-12 opacity-5"><Icons.Activity /></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-10">
              <div>
                <h3 className="text-4xl font-black italic tracking-tighter mb-3">{t.availabilityHistory}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg">
                  {t.availabilityDescription}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-3 bg-green-500/10 px-8 py-4 rounded-3xl border border-green-500/20">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-black uppercase tracking-widest text-green-500">{t.compositeUptime}</span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase italic px-4">{t.clusterId}</span>
              </div>
            </div>
            
            <div className="space-y-6">
              {filteredServices.map((service, idx) => (
                <div key={idx} className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] hover:bg-white/10 transition-all group hover:border-blue-500/20 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-5">
                      <div className={`w-3.5 h-3.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                        service.status === 'operational' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                      }`}></div>
                      <div>
                        <div className="text-xl font-black italic tracking-tight group-hover:text-blue-500 transition-colors">
                          {service.name}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase italic tracking-widest">
                          {service.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.currentLatency}</div>
                        <div className="text-sm font-black italic text-blue-500 tabular-nums">{service.latency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.serviceUptime}</div>
                        <div className="text-sm font-black italic text-green-500 tabular-nums">{service.uptime}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">
                      <span>{t.historicalMatrix}</span>
                      <span className="text-blue-500/50">{t.continuousHealthIndex}</span>
                    </div>
                    <UptimeBar history={service.history} size="h-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityStatusPage;

