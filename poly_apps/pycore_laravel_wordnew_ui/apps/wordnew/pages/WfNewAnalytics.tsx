import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Award, Zap, Clock, BrainCircuit, RefreshCw, Calendar,
  ChevronRight, Smile, TrendingUp, ShieldAlert, CheckCircle, Flame
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { wfNewApi, type AnalyticsStats } from '../api';

interface WfNewAnalyticsProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

// Empty shell shown until the API resolves (keeps every read below safe).
const EMPTY_STATS: AnalyticsStats = {
  totalStudyMins: 0, retentionRate: 0, cumulativeLearned: 0, vocabularyTarget: 0,
  streakDays: 0, weeklyActivity: [], categoryScores: [], recentlyStudiedTimeline: [],
};

export const WfNewAnalytics: React.FC<WfNewAnalyticsProps> = ({
  activeTheme,
  addToast,
  trans
}) => {
  const [stats, setStats] = useState<AnalyticsStats>(EMPTY_STATS);

  useEffect(() => {
    let alive = true;
    wfNewApi.getAnalytics()
      .then((s) => { if (alive && s) setStats(s); })
      .catch(() => { /* keep EMPTY_STATS on failure */ });
    return () => { alive = false; };
  }, []);

  // State to simulate Ebbinghaus forgetting Curve decay
  const [synapticStrength, setSynapticStrength] = useState<number>(86);
  const [decayDay, setDecayDay] = useState<number>(1); // simulation days passed
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Trigger simulated memory recall review event
  const triggerRecollectionRecall = () => {
    setSynapticStrength(100);
    setDecayDay(1);
    addToast(trans('analytics.recallRestored'), "success");
  };

  const advanceDecayTimeline = () => {
    setDecayDay(prev => {
      const nextDay = prev + 1;
      // Formula for Ebbinghaus: b = 100 * (1.84 / ( (log10(t)*1.25) + 1.84 ))
      // Let's model a realistic exponential decay curve for UI demonstration
      const nextPct = Math.max(Math.round(100 * Math.pow(0.88, nextDay)), 18);
      setSynapticStrength(nextPct);
      return nextDay;
    });
    addToast(trans('analytics.healthDecayed'), "warning");
  };

  // Find max minutes to compute heights proportionally (guard empty load state)
  const maxWeeklyMins = stats.weeklyActivity.length
    ? Math.max(...stats.weeklyActivity.map(d => d.mins))
    : 1;

  return (
    <div id="analytics-panel-wrapper" className="space-y-8 py-2">
      
      {/* Symmetrical Header Overview with total study telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total hours */}
        <div className={`p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4`}>
          <div className="p-3 bg-indigo-500/15 rounded-xl text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">{trans('analytics.totalStudy')}</span>
            <p className="text-xl font-black font-mono mt-0.5">{stats.totalStudyMins} <span className="text-xs font-sans font-normal text-zinc-400">{trans('analytics.minsUnit')}</span></p>
          </div>
        </div>

        {/* Retention index */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">{trans('analytics.synRetention')}</span>
            <p className="text-xl font-black font-mono mt-0.5">{stats.retentionRate}%</p>
          </div>
        </div>

        {/* Cumulative learned */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-fuchsia-500/15 rounded-xl text-fuchsia-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">{trans('analytics.archivedLexicons')}</span>
            <p className="text-xl font-black font-mono mt-0.5">{stats.cumulativeLearned} <span className="text-xs font-sans text-zinc-500">/ {stats.vocabularyTarget}</span></p>
          </div>
        </div>

        {/* Streak active */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-orange-500/15 rounded-xl text-orange-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">{trans('analytics.sustainedStreak')}</span>
            <p className="text-xl font-black font-mono mt-0.5">{stats.streakDays} <span className="text-xs font-sans text-zinc-500">{trans('stats.days')}</span></p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Symmetrical Interactive Weekly Activity telemetry Bar Chart */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/40 border border-white/5 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-200">
                {trans('analytics.chartTitle')}
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{trans('analytics.chartSub')}</p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-zinc-400">
              {trans('analytics.weeklyOverview')}
            </span>
          </div>

          {/* Interactive animated HTML bar chart with labels and point-hovers */}
          <div className="h-64 flex items-end justify-between gap-2.5 pt-8 px-2 relative">
            {stats.weeklyActivity.map((day, dIdx) => {
              const heightPct = (day.mins / maxWeeklyMins) * 100;
              const isHovered = hoveredBarIndex === dIdx;

              return (
                <div 
                  key={day.day}
                  onMouseEnter={() => setHoveredBarIndex(dIdx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="flex-1 flex flex-col items-center group relative cursor-pointer"
                >
                  {/* Tooltip on active point hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.9 }}
                        animate={{ opacity: 1, y: -28, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-1 bg-slate-950 border border-white/10 rounded-lg py-1 px-2.5 text-center text-[10px] font-mono z-20 pointer-events-none shadow-xl min-w-[70px]"
                      >
                        <p className="text-indigo-400 font-bold">{day.mins} {trans('analytics.minsUnit')}</p>
                        <p className="text-zinc-500">{day.count} {trans('profile.wordsUnit')}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bar pillar */}
                  <div className="w-full bg-slate-950/40 rounded-t-xl h-48 flex items-end overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: dIdx * 0.05 }}
                      className={`w-full rounded-t-lg transition-all ${
                        isHovered 
                          ? 'bg-gradient-to-t from-fuchsia-600 via-indigo-500 to-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]' 
                          : 'bg-gradient-to-t from-indigo-950 via-indigo-600/40 to-indigo-500/60'
                      }`}
                    />
                  </div>

                  {/* Day Label text */}
                  <span className={`text-[10px] font-mono mt-3 transition-colors ${
                    isHovered ? 'text-indigo-400 font-bold' : 'text-zinc-500'
                  }`}>
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Symmetrical analytics legend notes */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 text-center text-xs font-mono text-zinc-500">
            <div>
              <p className="text-slate-300 font-bold">1.8h Max</p>
              <span>{trans('analytics.peakDay')}</span>
            </div>
            <div>
              <p className="text-slate-300 font-bold">64.2 mins</p>
              <span>{trans('analytics.dailyMean')}</span>
            </div>
            <div>
              <p className="text-slate-300 font-bold">+28%</p>
              <span>{trans('analytics.weeklyChange')}</span>
            </div>
          </div>

        </div>

        {/* RIGHT: Interactive retention forgetting curve simulator */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/40 border border-white/5 space-y-6">
          
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-200">
              {trans('analytics.decayTitle')}
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{trans('analytics.decaySub')}</p>
          </div>

          {/* Dial container */}
          <div className="flex flex-col items-center py-4 space-y-4 text-center">
            
            {/* Visual Circular dialysis ring percentage */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                <circle 
                  cx="50" 
                  cy="50" 
                  r="42" 
                  className="stroke-zinc-800/40 fill-none" 
                  strokeWidth="8" 
                />
                <motion.circle 
                  cx="50" 
                  cy="50" 
                  r="42" 
                  className="stroke-indigo-500 fill-none" 
                  strokeWidth="8" 
                  strokeDasharray="264"
                  animate={{
                    strokeDashoffset: 264 - (264 * synapticStrength) / 100
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col justify-center items-center font-mono">
                <span className="text-[10px] text-zinc-500 uppercase">{trans('analytics.synapse')}</span>
                <span className="text-3xl font-black tracking-tight text-white">{synapticStrength}%</span>
                <span className="text-[9px] text-zinc-500">{trans('analytics.dayElapsed', { n: decayDay })}</span>
              </div>
            </div>

            <div className="space-y-1 max-w-[210px]">
              <h4 className="text-xs font-bold text-slate-200">
                {synapticStrength > 75 ? trans('analytics.synSaturated') : synapticStrength > 50 ? trans('analytics.synFading') : trans('analytics.synVulnerable')}
              </h4>
              <p className="text-[10px] text-zinc-500 leading-normal">
                {trans('analytics.decayNote')}
              </p>
            </div>

            {/* Simulated tool keys to step-by-step decay or restore */}
            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={advanceDecayTimeline}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 border border-white/5 active:scale-95 transition-all"
                title={trans('analytics.decayBtnTitle')}
              >
                {trans('analytics.decayBtn')}
              </button>
              <button
                onClick={triggerRecollectionRecall}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[10px] font-mono font-bold uppercase tracking-wider text-white active:scale-95 transition-all outline-none"
                title={trans('analytics.recallBtnTitle')}
              >
                {trans('analytics.recallBtn')}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Symmetrical Bottom Category breakdowns & Timeline reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        
        {/* Category breakdown meters */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 space-y-4">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400">
            {trans('analytics.categoryTitle')}
          </h3>

          <div className="space-y-3.5 pt-1">
            {stats.categoryScores.map((cat, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono text-zinc-400">
                  <span className="text-slate-200 text-xs truncate max-w-xs">{cat.name} ({cat.count} {trans('profile.wordsUnit')})</span>
                  <span className="font-extrabold text-indigo-400">{cat.score}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.score}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut', delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently studied timeline */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 space-y-4">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400">
            {trans('analytics.timelineTitle')}
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar pt-1">
            {stats.recentlyStudiedTimeline.map((item, idx) => (
              <div key={idx} className="p-3 bg-white/5 border border-white/5 hover:border-indigo-500/10 rounded-xl flex justify-between items-center transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'Mastered' ? 'bg-emerald-400' : item.status === 'Familiar' ? 'bg-indigo-400' : 'bg-amber-400'
                  }`} />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-100">{item.word}</h4>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide bg-white/5 px-2 py-0.5 rounded block w-fit mt-1">{item.status}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
