import React, { useEffect, useState } from 'react';
import { RPCClient } from '../services/rpc';
import { Alert, PageRoute } from '../types';
import { Bell, AlertTriangle, CheckCircle, Clock, Trash2, Settings } from 'lucide-react';

interface AlertsPageProps {
  onNavigate?: (page: PageRoute) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigate }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await RPCClient.getAlerts();
      // Sort alerts by timestamp descending
      setAlerts(data.alerts.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2000);
    return () => clearInterval(interval);
  }, []);

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all alert history?')) {
      setAlerts([]);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleTimeString();
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 flex-none">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="text-app-warn" />
            Active Alerts
          </h2>
          <p className="text-gray-400 mt-1">Real-time price anomalies and signals</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onNavigate?.('config')}
            className="flex items-center gap-2 px-4 py-2 bg-app-surface border border-app-border rounded hover:bg-white/5 transition-colors text-sm text-gray-300"
          >
             <Settings size={16} />
             Configure Thresholds
          </button>
          <button 
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 bg-app-surface border border-red-900/30 text-red-400 rounded hover:bg-red-900/10 transition-colors text-sm"
          >
             <Trash2 size={16} />
             Clear History
          </button>
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1 p-2">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <CheckCircle size={64} className="text-green-500/20" />
            <div>
              <p className="text-xl font-medium text-gray-300">All Quiet</p>
              <p className="text-sm text-gray-500">No active alerts detected in the last 24 hours.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-app-border">
            {alerts.map((alert, idx) => {
               const isSpike = alert.change_percent > 0;
               return (
                 <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg mx-2 my-1">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSpike ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                       <AlertTriangle size={20} />
                     </div>
                     <div>
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-lg">{alert.coin}</span>
                         <span className={`text-xs px-2 py-0.5 rounded border ${isSpike ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
                           {alert.alert_type.replace('_', ' ').toUpperCase()}
                         </span>
                       </div>
                       <div className="text-sm text-gray-400 mt-1">
                         Significant price movement of <span className="text-white font-mono">{alert.change_percent}%</span> detected in {alert.timeframe}.
                       </div>
                     </div>
                   </div>
                   <div className="text-right flex flex-col items-end gap-1">
                     <div className="flex items-center gap-1 text-xs text-gray-500">
                       <Clock size={12} />
                       {formatTime(alert.timestamp)}
                     </div>
                     <button className="text-xs text-app-accent hover:underline">Dismiss</button>
                   </div>
                 </div>
               );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};