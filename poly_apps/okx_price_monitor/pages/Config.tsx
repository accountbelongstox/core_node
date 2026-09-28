import React, { useEffect, useState } from 'react';
import { HttpClient } from '../services/http';
import { Save, RefreshCw, Power } from 'lucide-react';

export const ConfigPage: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await HttpClient.getConfig();
      setConfig(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real app we would construct the updates object from form state
      // For this demo, we assume the config object in state is what we want to save
      await HttpClient.updateConfig(config);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>Loading configuration...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">System Configuration</h2>

      <div className="space-y-6">
        {/* Core Settings */}
        <div className="bg-app-surface border border-app-border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 text-white">Data Fetching</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Update Interval (ms)</label>
              <input 
                type="number" 
                value={config?.update_interval_ms || 5000} 
                onChange={(e) => handleChange('update_interval_ms', parseInt(e.target.value))}
                className="w-full bg-app-bg border border-app-border rounded px-3 py-2 focus:border-app-accent outline-none text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Frequency of data polling from OKX API.</p>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Coins to Monitor</label>
              <input 
                type="number" 
                value={config?.max_coins || 297} 
                onChange={(e) => handleChange('max_coins', parseInt(e.target.value))}
                className="w-full bg-app-bg border border-app-border rounded px-3 py-2 focus:border-app-accent outline-none text-white"
              />
            </div>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="bg-app-surface border border-app-border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 text-white">Alert Thresholds</h3>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm text-gray-400 mb-1">1m Change (%)</label>
               <input type="number" step="0.1" className="w-full bg-app-bg border border-app-border rounded px-3 py-2 focus:border-app-accent outline-none text-white" placeholder="0.5" />
             </div>
             <div>
               <label className="block text-sm text-gray-400 mb-1">5m Change (%)</label>
               <input type="number" step="0.1" className="w-full bg-app-bg border border-app-border rounded px-3 py-2 focus:border-app-accent outline-none text-white" placeholder="1.2" />
             </div>
             <div>
               <label className="block text-sm text-gray-400 mb-1">Volume Spike (x)</label>
               <input type="number" step="0.1" className="w-full bg-app-bg border border-app-border rounded px-3 py-2 focus:border-app-accent outline-none text-white" placeholder="3.0" />
             </div>
          </div>
        </div>

        {/* Control Actions */}
        <div className="flex gap-4 pt-4">
           <button 
             onClick={handleSave}
             disabled={saving}
             className="flex-1 bg-app-accent hover:bg-blue-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
           >
             {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
             {saving ? 'Saving...' : 'Save Configuration'}
           </button>
           
           <button 
             onClick={loadConfig}
             className="px-6 bg-app-surface border border-app-border hover:bg-white/5 text-gray-300 font-medium rounded-lg transition-colors"
           >
             Reset
           </button>
        </div>

        {status === 'success' && (
          <div className="p-4 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg text-sm text-center">
            Configuration saved successfully.
          </div>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-app-border">
        <h3 className="text-red-500 font-bold mb-4">Danger Zone</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded hover:bg-red-500/20 transition-colors">
          <Power size={18} />
          Stop Monitoring Service
        </button>
      </div>
    </div>
  );
};
