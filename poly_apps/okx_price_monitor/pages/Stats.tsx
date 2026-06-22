import React, { useEffect, useState } from 'react';
import { RPCClient } from '../services/rpc';
import { SystemStats } from '../types';
import { Database, Activity, Clock, Server } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

export const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    RPCClient.getStats().then(setStats).catch(console.error);
  }, []);

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-app-surface border border-app-border p-6 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm mb-1">{label}</p>
          <h3 className="text-2xl font-bold font-mono">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={color} size={24} />
        </div>
      </div>
    </div>
  );

  const mockDiskData = [
    { name: 'Used', value: 450 },
    { name: 'Free', value: 1200 },
  ];
  const COLORS = ['#3b82f6', '#1f1f23'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">System Status</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Database} label="Total Records" value={stats?.total_records.toLocaleString() || '---'} color="text-blue-500" />
        <StatCard icon={Activity} label="Active Coins" value={stats?.total_coins || '---'} color="text-green-500" />
        <StatCard icon={Clock} label="Update Rate" value={stats?.update_rate || '---'} color="text-purple-500" />
        <StatCard icon={Server} label="Uptime" value="3d 12h" color="text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-app-surface border border-app-border rounded-lg p-6">
          <h3 className="font-bold mb-4">Database Health</h3>
          <div className="flex items-center gap-8">
            <div className="h-48 w-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockDiskData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {mockDiskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                28% Used
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Data Size: 450 MB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#1f1f23] rounded-full border border-gray-700"></div>
                <span>Free Space: 1.2 GB</span>
              </div>
              <div className="text-xs text-gray-500 mt-4">
                Last optimization: 2 hours ago
              </div>
            </div>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-lg p-6">
           <h3 className="font-bold mb-4">Service Logs</h3>
           <div className="h-48 overflow-y-auto font-mono text-xs text-gray-400 space-y-1 pr-2">
             <div className="flex gap-2">
               <span className="text-green-500">[INFO]</span>
               <span className="text-gray-600">10:45:02</span>
               <span>Fetching batch #40592 from OKX API...</span>
             </div>
             <div className="flex gap-2">
               <span className="text-green-500">[INFO]</span>
               <span className="text-gray-600">10:45:03</span>
               <span>Processed 297 items in 124ms.</span>
             </div>
             <div className="flex gap-2">
               <span className="text-green-500">[INFO]</span>
               <span className="text-gray-600">10:45:03</span>
               <span>Database updated successfully.</span>
             </div>
             <div className="flex gap-2">
               <span className="text-yellow-500">[WARN]</span>
               <span className="text-gray-600">10:45:05</span>
               <span>Latency spike detected on node us-east-1.</span>
             </div>
             {/* Filler logs */}
             {Array.from({length: 5}).map((_, i) => (
                <div key={i} className="flex gap-2 opacity-50">
                  <span className="text-gray-500">[DEBUG]</span>
                  <span className="text-gray-700">10:44:{50-i}</span>
                  <span>Heartbeat acknowledged.</span>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};