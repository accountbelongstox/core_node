
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UsageHistory } from '../types';

const data: UsageHistory[] = [
  { date: 'Mon', tokens: 12000, images: 45 },
  { date: 'Tue', tokens: 45000, images: 82 },
  { date: 'Wed', tokens: 32000, images: 31 },
  { date: 'Thu', tokens: 88000, images: 124 },
  { date: 'Fri', tokens: 95000, images: 156 },
  { date: 'Sat', tokens: 54000, images: 67 },
  { date: 'Sun', tokens: 41000, images: 54 },
];

const UsageCharts: React.FC = () => {
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="glass p-10 rounded-[3rem] border-white/5">
      <div className="flex justify-between items-center mb-10">
        <h3 className="text-2xl font-black italic tracking-tight">Neural Pulse</h3>
        <select className="dark:bg-white/5 bg-slate-100 border dark:border-white/10 border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none">
          <option>Weekly Telemetry</option>
          <option>Monthly Telemetry</option>
        </select>
      </div>
      
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="5 5" vertical={false} stroke={isDark ? "#ffffff11" : "#00000011"} />
            <XAxis 
              dataKey="date" 
              stroke={isDark ? "#64748b" : "#94a3b8"} 
              fontSize={10} 
              fontWeight="800"
              tickLine={false} 
              axisLine={false} 
              tick={{ dy: 10 }}
            />
            <YAxis 
              stroke={isDark ? "#64748b" : "#94a3b8"} 
              fontSize={10} 
              fontWeight="800"
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                border: 'none', 
                borderRadius: '1.5rem',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                padding: '1rem'
              }}
              itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
            />
            <Area 
              type="monotone" 
              dataKey="tokens" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorTokens)" 
              strokeWidth={4}
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UsageCharts;
