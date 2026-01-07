
import React, { useState, createContext, useContext, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons, PLANS, AVAILABILITY_DATA, HISTORICAL_UPTIME } from './constants';
import PricingSection from './components/PricingSection';
import UsageCharts from './components/UsageCharts';
import PlanAdvisor from './components/PlanAdvisor';
import { translations } from './i18n';
import { Language, Theme, ApiKey, UptimePoint, SystemStatus } from './types';

const AppContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  user: any;
  setUser: (u: any) => void;
  t: any;
} | null>(null);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppContext missing");
  return context;
};

// --- Sub-Components ---

const UptimeBar = ({ history, size = "h-4" }: { history: UptimePoint[], size?: string }) => (
  <div className={`flex gap-[2px] ${size} w-full items-center`}>
    {history.map((entry, idx) => (
      <div 
        key={idx} 
        className={`uptime-dot flex-1 ${
          entry.status === 'up' ? 'bg-green-500/40 hover:bg-green-400' : 
          entry.status === 'partial' ? 'bg-yellow-500/40 hover:bg-yellow-400' : 'bg-red-500/40 hover:bg-red-400'
        }`}
        title={`Status: ${entry.status.toUpperCase()} | Index -${history.length - 1 - idx}`}
      />
    ))}
  </div>
);

const ModelStatusCard = ({ service }: { service: SystemStatus }) => (
  <div className="glass p-5 rounded-[2rem] border-white/5 hover:border-blue-500/20 transition-all group">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${service.status === 'operational' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
        <span className="text-[10px] font-black uppercase tracking-widest dark:text-slate-300 text-slate-700">{service.name}</span>
      </div>
      <span className="text-[9px] font-black text-blue-500 tabular-nums">{service.latency}</span>
    </div>
    <UptimeBar history={service.history} size="h-3" />
  </div>
);

const Logo = ({ className = "", showText = true }: { className?: string, showText?: boolean }) => (
  <div className={`flex items-center gap-3 group ${className}`}>
    <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center font-bold italic text-white shadow-2xl transition-all group-hover:rotate-12 group-hover:scale-110">
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    {showText && (
      <span className="font-extrabold text-2xl tracking-tighter dark:text-white text-slate-900">
        toprouter<span className="text-blue-500">.cn</span>
      </span>
    )}
  </div>
);

// --- Pages ---

const LoginPage = () => {
  const { setUser, t, lang } = useAppContext();
  const [email, setEmail] = useState('');
  
  return (
    <div className="min-h-screen relative flex items-center justify-end p-4 sm:p-12 md:p-24 overflow-hidden">
      {/* Dynamic Cinematic Content (Left Side) */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <div className="absolute top-1/2 left-12 md:left-24 -translate-y-1/2 max-w-2xl hidden lg:block animate-in fade-in slide-in-from-left-10 duration-1000">
          <Logo className="scale-125 origin-left mb-16" />
          <div className="space-y-12">
            <div>
              <h2 className="text-7xl font-black leading-none tracking-tighter dark:text-white text-slate-900 mb-8">
                {lang === 'zh' ? '开启' : 'Enter the'}<br />
                <span className="gradient-text italic">{lang === 'zh' ? '多模型加速矩阵' : 'Multi-Neural Matrix'}</span>
              </h2>
              <p className="text-xl dark:text-slate-400 text-slate-600 font-medium max-w-lg leading-relaxed mb-10">
                {lang === 'zh' 
                  ? '汇聚 Claude, Gemini, Codex 等顶尖算力。毫秒级转发中枢，为您的应用注入超脑核心。' 
                  : 'Converging elite power from Claude, Gemini, and GPT. A millisecond-speed hub for your AI-native future.'}
              </p>
            </div>
            
            {/* Multi-AI Availability History on Home Page */}
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              {AVAILABILITY_DATA.slice(0, 4).map(service => (
                <ModelStatusCard key={service.name} service={service} />
              ))}
              <div className="col-span-2 glass p-6 rounded-[2rem] border-blue-500/10 mt-4">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{lang === 'zh' ? '全局链路脉冲' : 'Global Backbone Pulse'}</span>
                    <span className="text-[10px] font-black text-green-500">99.98% HEALTH</span>
                 </div>
                 <UptimeBar history={HISTORICAL_UPTIME.slice(0, 30)} size="h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Login Card (Right Side Float) */}
      <div className="relative z-10 w-full max-w-lg animate-in zoom-in-95 fade-in duration-1000">
        <div className="glass p-12 md:p-16 rounded-[4rem] border-white/10 dark:border-white/5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] bg-white/10 dark:bg-white/[0.01] backdrop-blur-3xl">
          <div className="lg:hidden mb-12 flex justify-center"><Logo /></div>
          
          <div className="mb-12">
            <h1 className="text-4xl font-black tracking-tight mb-3 dark:text-white text-slate-900 italic">{t.loginTitle}</h1>
            <p className="dark:text-slate-500 text-slate-500 font-medium text-sm">{t.loginSubtitle}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setUser({ name: 'Creator', email }); }} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-[0.2em] px-1">{t.email}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-blue-500">
                   <Icons.Shield />
                </div>
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="operator@toprouter.cn"
                  className="w-full bg-slate-500/5 dark:bg-white/5 border dark:border-white/10 border-slate-200 rounded-[2rem] py-5 pl-16 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-[0.2em] px-1">{t.password}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-purple-500">
                   <Icons.Zap />
                </div>
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-slate-500/5 dark:bg-white/5 border dark:border-white/10 border-slate-200 rounded-[2rem] py-5 pl-16 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                />
              </div>
            </div>
            
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] transition-all glow-button shadow-2xl shadow-blue-500/30 uppercase tracking-[0.3em] text-[10px]">
              {t.signIn}
            </button>
          </form>

          <div className="mt-14 pt-10 border-t dark:border-white/5 border-slate-200">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 text-center">Neural Infrastructure V3.0</div>
             <div className="flex justify-around items-center">
                {['CLAUDE', 'GEMINI', 'GPT-4'].map(model => (
                  <div key={model} className="flex flex-col items-center gap-1 group">
                    <div className="text-[9px] font-black italic text-slate-500 group-hover:text-blue-500 transition-colors">{model}</div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                ))}
             </div>
          </div>
          
          <p className="text-center text-[9px] dark:text-slate-700 text-slate-400 mt-12 uppercase tracking-[0.5em] font-black">{t.demoAccount}</p>
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { t, lang } = useAppContext();
  const inviteCode = "TOP-X-NXS-MATRIX";

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
               <span>Utilization Rate</span>
               <span className="text-blue-500">{stat.limit === '∞' ? 'Unlimited' : `${Math.round((parseFloat(stat.value)/parseFloat(stat.limit))*100)}%`}</span>
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
                  <h3 className="text-4xl font-black italic tracking-tighter mb-3">{lang === 'zh' ? '全模型可用性历史' : 'Neural Availability History'}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg">
                    {lang === 'zh' ? '实时追踪与历史回溯 Claude, Gemini, GPT 等顶级模型的中转效能。' : 'Real-time telemetry and historical performance for elite AI models.'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <div className="flex items-center gap-3 bg-green-500/10 px-8 py-4 rounded-3xl border border-green-500/20">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs font-black uppercase tracking-widest text-green-500">99.98% Composite Uptime</span>
                   </div>
                   <span className="text-[9px] font-black text-slate-500 uppercase italic px-4">Cluster ID: NXS-0012</span>
                </div>
              </div>
              
              <div className="space-y-10">
                {AVAILABILITY_DATA.map((service, idx) => (
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
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{lang === 'zh' ? '当前延迟' : 'Latency'}</div>
                            <div className="text-sm font-black italic text-blue-500 tabular-nums">{service.latency}</div>
                         </div>
                         <div className="text-right">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{lang === 'zh' ? '服务在线率' : 'Uptime'}</div>
                            <div className="text-sm font-black italic text-green-500 tabular-nums">{service.uptime}%</div>
                         </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">
                          <span>{lang === 'zh' ? '30天历史效能回溯' : '30-Day Historical Matrix'}</span>
                          <span className="text-blue-500/50">Continuous Health Index</span>
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
                  <h3 className="text-3xl font-black italic tracking-tight mb-2">Technical Spotlight</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Core integration references for the Matrix API.</p>
                </div>
                <Link to="/docs" className="text-xs font-black uppercase text-blue-500 hover:underline tracking-widest">Open Knowledge Base</Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { title: 'Neural Routing V3', desc: 'Next-gen cross-border latency optimization.', icon: <Icons.Zap /> },
                  { title: 'Multi-AI Authentication', desc: 'Single-key access to Claude, Gemini & GPT.', icon: <Icons.Shield /> },
                  { title: 'Matrix Edge SDK', desc: 'Deploy millisecond-speed links instantly.', icon: <Icons.Cpu /> },
                  { title: 'Rate Management', desc: 'Scaling high-throughput enterprise nodes.', icon: <Icons.Check /> },
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
            <h3 className="text-3xl font-black mb-8 tracking-tighter italic">Route Telemetry</h3>
            <div className="space-y-5">
              {[
                { name: 'US-EAST-PROXY', val: '98ms', color: '#10b981' },
                { name: 'ASIA-HK-PROXY', val: '18ms', color: '#3b82f6' },
                { name: 'EU-WEST-CORE', val: '41ms', color: '#a855f7' },
                { name: 'AU-SYD-EDGE', val: '109ms', color: '#f59e0b' },
                { name: 'SA-BRA-PROXY', val: '184ms', color: '#ef4444' },
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
               Neural Latency Map
            </button>
          </div>
          
          {/* Nexus Community & News */}
          <div className="glass p-10 rounded-[3.5rem] border-white/5 bg-slate-500/[0.03] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none italic font-black text-9xl -rotate-12 translate-x-4 -translate-y-4 select-none">MATRIX</div>
             <div className="flex items-center justify-between mb-10 relative z-10">
               <div className="text-[11px] font-black uppercase text-slate-500 tracking-widest italic">Matrix System Log</div>
               <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
             </div>
             <div className="space-y-10 relative z-10">
                <div className="group cursor-pointer">
                   <div className="text-sm font-black mb-2 uppercase tracking-tight italic group-hover:text-blue-500 transition-colors">Neural Sync V4.0.0 Deploying</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">Native support for DeepSeek V3 routing clusters added. 25% throughput increase across EU nodes.</p>
                </div>
                <div className="h-[1px] bg-white/5"></div>
                <div className="group cursor-pointer">
                   <div className="text-sm font-black mb-2 uppercase tracking-tight italic group-hover:text-purple-500 transition-colors">Enterprise API Shifting</div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">Automatic fallback systems optimized for Claude 3.5 Sonnet surges.</p>
                </div>
             </div>
             
             <div className="mt-14 pt-14 border-t border-white/5 relative z-10">
                <div className="flex -space-x-4 mb-8">
                  {[1,2,3,4,5,6,7].map(i => <img key={i} src={`https://picsum.photos/id/${i+250}/100/100`} className="w-12 h-12 rounded-full border-4 dark:border-[#030014] border-slate-50 shadow-2xl transition-transform hover:-translate-y-2 cursor-pointer" />)}
                  <div className="w-12 h-12 rounded-full border-4 dark:border-[#030014] border-slate-50 bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-xl">+5.1k</div>
                </div>
                <h4 className="font-black text-2xl mb-3 italic tracking-tight">Join the Node Syndicate</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-10 font-medium">Connect with 5,100+ matrix engineers routing AI at the bleeding edge.</p>
                <button className="w-full bg-slate-900 dark:bg-white text-white dark:text-black py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.03] transition-all shadow-2xl active:scale-95">Discord Synchronize</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KeysPage = () => {
  const { t } = useAppContext();
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Dev-Bot-Alpha', key: 'sk-tp-88...2k1', createdAt: '2024-06-12', status: 'active' },
    { id: '2', name: 'Prod-Matrix-HK', key: 'sk-tp-12...x92', createdAt: '2024-07-01', status: 'active' },
    { id: '3', name: 'Claude-Sync-Proxy', key: 'sk-tp-42...a11', createdAt: '2024-08-15', status: 'active' },
  ]);

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-16">
        <div>
          <h1 className="text-5xl font-black tracking-tight mb-3 italic">{t.apiKeys}</h1>
          <p className="dark:text-slate-400 text-slate-500 text-lg font-medium">Manage your neural routing access keys for the Matrix.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-12 rounded-[2rem] text-[10px] uppercase tracking-[0.3em] transition-all glow-button shadow-2xl shadow-blue-500/30">
          {t.generateKey}
        </button>
      </div>

      <div className="glass rounded-[4rem] overflow-hidden border-white/5 shadow-2xl">
        <table className="w-full text-left">
          <thead className="dark:bg-white/5 bg-slate-50 border-b dark:border-white/5 border-slate-200">
            <tr className="text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500">
              <th className="px-12 py-10 italic">{t.keyName}</th>
              <th className="px-12 py-10 italic">Neural Preview</th>
              <th className="px-12 py-10 italic">{t.keyCreated}</th>
              <th className="px-12 py-10 italic">{t.keyStatus}</th>
              <th className="px-12 py-10 italic"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-white/5 divide-slate-100 font-medium">
            {keys.map(k => (
              <tr key={k.id} className="dark:hover:bg-white/[0.02] hover:bg-slate-50/50 transition-colors group">
                <td className="px-12 py-10 text-base font-black italic">{k.name}</td>
                <td className="px-12 py-10"><code className="bg-slate-500/10 dark:text-blue-400 text-blue-600 px-5 py-3 rounded-2xl text-xs font-mono font-bold">{k.key}</code></td>
                <td className="px-12 py-10 text-sm text-slate-500">{k.createdAt}</td>
                <td className="px-12 py-10">
                  <span className="text-[10px] font-black bg-green-500/10 text-green-500 px-5 py-2 rounded-full border border-green-500/20 uppercase tracking-widest">{k.status}</span>
                </td>
                <td className="px-12 py-10 text-right">
                  <button className="text-[10px] font-black text-red-500/50 hover:text-red-500 transition-colors uppercase tracking-[0.4em]">Sever Link</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DocsPage = () => {
  const { t } = useAppContext();
  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto">
      <div className="text-center mb-24">
        <h1 className="text-7xl font-black mb-8 tracking-tighter italic">{t.docsTitle}</h1>
        <div className="max-w-2xl mx-auto relative group">
          <input 
            type="text" 
            placeholder={t.docsSearch} 
            className="w-full glass rounded-[3rem] py-7 px-10 text-base outline-none focus:ring-4 focus:ring-blue-500/20 border-white/10 transition-all font-medium placeholder:text-slate-600 shadow-2xl" 
          />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[11px] border border-white/10 px-5 py-3 rounded-2xl bg-white/5 shadow-inner select-none pointer-events-none font-bold">⌘ K</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {[
          { title: 'Neural Matrix Routing', desc: 'Core infrastructure and V3 pathing protocols.', items: ['Multi-Model Edge Arch', 'Latency Tuning Guide', 'Region Fallback Logic'] },
          { title: 'REST API Spec', desc: 'Enterprise-grade neural link specifications.', items: ['Auth V3 Protocols', 'Batch Inference Sync', 'Real-time Streaming'] },
          { title: 'Developer Kits', desc: 'Instant deployment tools for the Syndicate.', items: ['React Hooks Matrix', 'Python Enterprise Client', 'Go Network Driver'] },
        ].map((cat, idx) => (
          <div key={idx} className="glass p-14 rounded-[4rem] border-white/5 shadow-2xl hover:border-blue-500/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors"></div>
            <h4 className="text-3xl font-black mb-3 italic tracking-tight relative z-10">{cat.title}</h4>
            <p className="text-xs text-slate-500 mb-10 font-medium relative z-10 leading-relaxed">{cat.desc}</p>
            <ul className="space-y-6 relative z-10">
              {cat.items.map((i, iidx) => (
                <li key={iidx} className="group/item">
                  <a href="#" className="text-sm font-bold dark:text-slate-400 text-slate-600 hover:text-blue-500 transition-all flex items-center justify-between">
                    {i} 
                    <span className="opacity-0 group-hover/item:opacity-100 transition-all translate-x-3 group-hover/item:translate-x-0"><Icons.Check /></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { t, user } = useAppContext();
  return (
    <div className="animate-in fade-in duration-700">
      <h1 className="text-5xl font-black mb-16 tracking-tight italic">{t.settings}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-4">
          {['Identity & Syndicate', 'Neural Billing', 'Routing Keys', 'Security Matrix'].map((tab, i) => (
            <button key={tab} className={`w-full text-left px-10 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${i === 0 ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/30' : 'hover:bg-slate-500/5 dark:text-slate-500 text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="lg:col-span-3 space-y-12">
          <div className="glass p-16 rounded-[4.5rem] border-white/5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row items-center gap-14 mb-20 relative z-10">
              <div className="w-40 h-40 rounded-[3.5rem] overflow-hidden ring-[12px] ring-blue-500/10 relative group shadow-2xl">
                <img src="https://picsum.photos/id/1012/500/500" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md">
                  <span className="text-[11px] font-black text-white uppercase tracking-widest">Shift Avatar</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-5xl font-black mb-3 italic tracking-tighter">{user.name}</h2>
                <p className="dark:text-slate-500 text-slate-400 font-mono text-base mb-8">{user.email}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                  <span className="bg-blue-600/10 text-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-xl shadow-blue-500/5">Pro Syndicate</span>
                  <span className="bg-slate-500/10 dark:text-slate-400 text-slate-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border dark:border-white/5 border-slate-200">Matrix-ID: NXS-X8</span>
                </div>
              </div>
            </div>
            <div className="grid gap-10 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="space-y-5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Neural Synchronizer</label>
                  <div className="glass p-8 rounded-[2rem] border-white/5 font-black italic text-base shadow-inner bg-black/5 dark:bg-white/[0.02]">UTC+8 (Shanghai)</div>
                </div>
                <div className="space-y-5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Matrix Interface Lang</label>
                  <div className="glass p-8 rounded-[2rem] border-white/5 font-black italic text-base shadow-inner bg-black/5 dark:bg-white/[0.02]">Simplified Chinese Matrix</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Layout ---

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, setLang, theme, setTheme, user, setUser, t } = useAppContext();
  const location = useLocation();

  const navItems = [
    { name: t.dashboard, path: '/', icon: <Icons.Cpu /> },
    { name: t.membership, path: '/membership', icon: <Icons.Zap /> },
    { name: t.apiKeys, path: '/keys', icon: <Icons.Shield /> },
    { name: t.docs, path: '/docs', icon: <Icons.Activity /> },
    { name: t.settings, path: '/settings', icon: <Icons.Check /> },
  ];

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Mobile/Desktop Sidebar */}
      <aside className="w-80 h-screen border-r dark:border-white/5 border-slate-200 hidden lg:flex flex-col p-12 bg-white/20 dark:bg-black/10 backdrop-blur-3xl z-50 shrink-0">
        <Logo className="mb-24 scale-110 origin-left" />
        
        <nav className="space-y-5 flex-grow overflow-y-auto custom-scrollbar pr-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-6 p-6 rounded-[2rem] transition-all font-black italic tracking-tight text-[11px] uppercase group ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/50' 
                    : 'dark:text-slate-500 text-slate-500 hover:bg-blue-600/15'
                }`}
              >
                <span className={`transition-transform group-hover:scale-110 group-hover:rotate-6 ${isActive ? 'text-white' : 'text-blue-500'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="pt-12 border-t dark:border-white/5 border-slate-200 space-y-10">
          <div className="flex items-center justify-between px-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-14 h-14 rounded-[1.5rem] bg-slate-500/5 flex items-center justify-center hover:bg-blue-600/15 transition-all text-blue-500 shadow-lg"
              title={t.themeToggle}
            >
              <Icons.Zap />
            </button>
            <button 
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="text-[10px] font-black uppercase tracking-[0.3em] px-7 py-4 rounded-[1.5rem] bg-slate-500/5 hover:bg-blue-600/15 transition-all shadow-lg"
            >
              {lang === 'zh' ? 'ENG' : '中文'}
            </button>
          </div>

          <div className="p-7 bg-slate-500/5 rounded-[2.5rem] border border-dashed dark:border-white/10 border-slate-200 group relative overflow-hidden">
             <div className="flex items-center gap-5 mb-5 relative z-10">
                <img src="https://picsum.photos/id/1012/100/100" className="w-12 h-12 rounded-2xl shadow-xl group-hover:scale-110 transition-transform" />
                <div className="overflow-hidden">
                   <div className="text-[11px] font-black italic truncate group-hover:text-blue-500 transition-colors">{user.name}</div>
                   <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] truncate">Neural Node X8</div>
                </div>
             </div>
             <button 
               onClick={() => setUser(null)}
               className="w-full py-4 text-[9px] font-black uppercase tracking-[0.4em] dark:text-slate-600 text-slate-500 hover:text-red-500 transition-colors text-center relative z-10"
             >
               {t.logout}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow h-screen overflow-y-auto relative custom-scrollbar">
        <div className="p-6 sm:p-12 md:p-20 max-w-[1700px] mx-auto min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const [theme, setTheme] = useState<Theme>('dark');
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    document.documentElement.className = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ lang, setLang, theme, setTheme, user, setUser, t }}>
      <HashRouter>
        {!user ? (
          <LoginPage />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/membership" element={<div className="animate-in fade-in duration-1000">
                <div className="max-w-4xl mx-auto text-center mb-28">
                  <h1 className="text-8xl font-black mb-8 tracking-tighter italic">{t.choosePower}</h1>
                  <p className="dark:text-slate-400 text-slate-500 text-3xl font-medium leading-relaxed">{t.scaleOps}</p>
                </div>
                <PricingSection />
              </div>} />
              <Route path="/keys" element={<KeysPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        )}
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;
