
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../constants';
import { useAppContext } from '../App';
import UsageCharts from '../components/UsageCharts';
import PlanAdvisor from '../components/PlanAdvisor';
import UptimeBar from '../components/UptimeBar';

const DashboardPage = () => {
  const { t, state, stateCenter } = useAppContext();
  const inviteCode = t.inviteCode;
  
  // Get availability data from state center
  const availabilityData = state.availabilityData.length > 0 
    ? state.availabilityData 
    : stateCenter.getAvailability();
  
  // Auto-refresh availability data
  useEffect(() => {
    const interval = setInterval(() => {
      stateCenter.refreshAvailability();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [stateCenter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 space-y-16 pb-20">
      {/* Hero Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
        <div>
          <h1 className="text-6xl font-black mb-4 tracking-tighter italic">{t.welcome} <span className="gradient-text">{t.creator}</span></h1>
          <p className="dark:text-slate-400 text-slate-500 text-2xl font-medium">{t.overview}</p>
        </div>
        <div className="glass p-7 rounded-[2.5rem] border-blue-500/10 flex items-center gap-6 w-full lg:w-auto shadow-2xl">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner"><Icons.Shield /></div>
          <div>
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-1">{t.inviteTitle}</div>
            <div className="flex items-center gap-4">
              <code className="text-sm font-black font-mono text-blue-500 bg-blue-500/5 px-4 py-2 rounded-xl">{inviteCode}</code>
              <button className="text-[10px] font-black uppercase bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">{t.copyInvite}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
        {[
          { label: t.tokensUsed, value: '1,429k', limit: '5.0M', color: '#3b82f6' },
          { label: t.imagesGenerated, value: '241', limit: '1,000', color: '#a855f7' },
          { label: t.computeTime, value: '18.4h', limit: '50h', color: '#10b981' },
          { label: t.activeProjects, value: '08', limit: '∞', color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="glass p-8 rounded-[3rem] hover:scale-105 transition-all duration-500 border-white/5 group relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-5 blur-3xl -mr-10 -mt-10" style={{ color: stat.color }}></div>
            <div className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-3">{stat.label}</div>
            <div className="text-4xl font-black mb-8 tracking-tighter italic">{stat.value}</div>
            <div className="w-full dark:bg-white/5 bg-slate-200 h-3 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(59,130,246,0.5)]" 
                style={{ backgroundColor: stat.color, width: stat.limit === '∞' ? '100%' : `${(parseFloat(stat.value)/parseFloat(stat.limit))*100}%` }}
              />
            </div>
            <div className="mt-5 flex justify-between text-[10px] font-black uppercase text-slate-500 tracking-tighter">
               <span>{t.utilizationRate}</span>
               <span className="text-blue-500">{stat.limit === '∞' ? t.unlimited : `${Math.round((parseFloat(stat.value)/parseFloat(stat.limit))*100)}%`}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Main Visual Telemetry */}
          <UsageCharts />
          
          {/* Detailed Multi-AI Model Availability Hub */}
          <div className="glass p-12 rounded-[4rem] border-white/5 relative overflow-hidden shadow-2xl bg-gradient-to-br from-green-500/5 to-transparent">
            <div className="absolute top-0 right-0 p-12 opacity-5"><Icons.Activity /></div>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-14">
                <div>
                  <Link to="/status" className="group">
                    <h3 className="text-4xl font-black italic tracking-tighter mb-3 group-hover:text-blue-500 transition-colors cursor-pointer">
                      {t.availabilityHistory}
                    </h3>
                  </Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg">
                    {t.availabilityDescription}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <Link to="/status" className="flex items-center gap-3 bg-green-500/10 px-8 py-4 rounded-3xl border border-green-500/20 hover:bg-green-500/20 transition-all group">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs font-black uppercase tracking-widest text-green-500 group-hover:text-blue-500 transition-colors">{t.compositeUptime}</span>
                   </Link>
                   <span className="text-[9px] font-black text-slate-500 uppercase italic px-4">{t.clusterId}</span>
                </div>
              </div>
              
              <div className="space-y-10">
                {availabilityData.map((service, idx) => (
                  <div key={idx} className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] hover:bg-white/10 transition-all group hover:border-blue-500/20 shadow-lg">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-5">
                        <div className={`w-3.5 h-3.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${service.status === 'operational' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                        <div>
                          <div className="text-xl font-black italic tracking-tight group-hover:text-blue-500 transition-colors">{service.name}</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase italic tracking-widest">{service.status}</div>
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

          {/* Technical Documentation Section */}
          <div className="glass p-12 rounded-[4rem] border-white/5 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] rounded-full -mr-32 -mt-32"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-black italic tracking-tight mb-2">{t.technicalSpotlight}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t.technicalSpotlightDesc}</p>
                </div>
                <Link to="/docs" className="text-xs font-black uppercase text-blue-500 hover:underline tracking-widest">{t.openKnowledgeBase}</Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { title: t.neuralRoutingV3, desc: t.neuralRoutingDesc, icon: <Icons.Zap /> },
                  { title: t.multiAIAuth, desc: t.multiAIAuthDesc, icon: <Icons.Shield /> },
                  { title: t.chainEdgeSDK, desc: t.chainEdgeSDKDesc, icon: <Icons.Cpu /> },
                  { title: t.rateManagement, desc: t.rateManagementDesc, icon: <Icons.Check /> },
                ].map(d => (
                  <div key={d.title} className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] hover:bg-white/10 transition-all cursor-pointer group hover:border-blue-500/30">
                    <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left">{d.icon}</div>
                    <div className="text-xl font-black mb-2 italic">{d.title}</div>
                    <div className="text-xs text-slate-500 font-medium leading-relaxed">{d.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-12">
          {/* AI Strategy Advisor */}
          <PlanAdvisor />

          {/* Global Node Health Monitor */}
          <div className="glass p-10 rounded-[3.5rem] bg-gradient-to-br from-blue-600/5 to-purple-600/5 dark:border-white/5 border-slate-200 shadow-2xl">
            <h3 className="text-3xl font-black mb-8 tracking-tighter italic">{t.routeTelemetry}</h3>
            <div className="space-y-5">
              {[
                { name: t.nodeUsEast, val: '98ms', color: '#10b981' },
                { name: t.nodeAsiaHk, val: '18ms', color: '#3b82f6' },
                { name: t.nodeEuWest, val: '41ms', color: '#a855f7' },
                { name: t.nodeAuSyd, val: '109ms', color: '#f59e0b' },
                { name: t.nodeSaBra, val: '184ms', color: '#ef4444' },
              ].map(n => (
                <div key={n.name} className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all group">
                  <div className="flex items-center gap-5">
                    <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,0,0,0.5)]`} style={{ backgroundColor: n.color }}></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">{n.name}</span>
                  </div>
                  <span className="text-xs font-black tabular-nums tracking-tighter" style={{ color: n.color }}>{n.val}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] border border-dashed dark:border-white/10 border-slate-300 rounded-[2rem] hover:text-blue-500 hover:border-blue-500/50 transition-all">
               {t.neuralLatencyMap}
            </button>
          </div>
          
          {/* Nexus Community & News */}
          <div className="glass p-10 rounded-[3.5rem] border-white/5 bg-slate-500/[0.03] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none italic font-black text-9xl -rotate-12 translate-x-4 -translate-y-4 select-none">TOPROUTER</div>
             <div className="flex items-center justify-between mb-10 relative z-10">
               <div className="text-[11px] font-black uppercase text-slate-500 tracking-widest italic">{t.chainSystemLog}</div>
               <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
             </div>
             <div className="space-y-10 relative z-10">
                <div className="group cursor-pointer">
                   <div className="text-sm font-black mb-2 uppercase tracking-tight italic group-hover:text-blue-500 transition-colors">{t.neuralSyncDeploying}</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">{t.neuralSyncDesc}</p>
                </div>
                <div className="h-[1px] bg-white/5"></div>
                <div className="group cursor-pointer">
                   <div className="text-sm font-black mb-2 uppercase tracking-tight italic group-hover:text-purple-500 transition-colors">{t.enterpriseAPIShifting}</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">{t.enterpriseAPIShiftingDesc}</p>
                </div>
             </div>
             
             <div className="mt-14 pt-14 border-t border-white/5 relative z-10">
                <div className="flex -space-x-4 mb-8">
                  {[1,2,3,4,5,6,7].map(i => <img key={i} src={`https://picsum.photos/id/${i+250}/100/100`} className="w-12 h-12 rounded-full border-4 dark:border-[#030014] border-slate-50 shadow-2xl transition-transform hover:-translate-y-2 cursor-pointer" />)}
                  <div className="w-12 h-12 rounded-full border-4 dark:border-[#030014] border-slate-50 bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-xl">+5.1k</div>
                </div>
                <h4 className="font-black text-2xl mb-3 italic tracking-tight">{t.joinNodeSyndicate}</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-10 font-medium">{t.joinNodeSyndicateDesc}</p>
                <button className="w-full bg-slate-900 dark:bg-white text-white dark:text-black py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.03] transition-all shadow-2xl active:scale-95">{t.discordSynchronize}</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

