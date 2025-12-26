import React from 'react';
import { SettingsLayout, SettingItem } from './Layout';
import { Button } from '../../components/UI';

const DataSyncPage = () => {
  return (
    <SettingsLayout title="Data & Sync">
       <div className="settings-section-title">Cloud Sync</div>
       <div className="settings-glass-group">
         <SettingItem label="Auto Sync" type="toggle" active={true} />
         <SettingItem label="Sync only on Wi-Fi" type="toggle" active={true} />
         <SettingItem label="Last Backup" value="Today, 10:00 AM" />
       </div>
       
       <div className="settings-section-title">Storage Usage</div>
       <div className="app-card p-4 mb-6">
          <div className="flex justify-between text-sm mb-3 text-secondary font-bold"><span>Used Storage</span><span>430 MB</span></div>
          <div className="w-full bg-slate-200 dark:bg-white/10 h-3 rounded-full overflow-hidden shadow-inner">
             <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-1/3 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
          </div>
          <div className="flex gap-4 mt-4 text-[10px] uppercase font-bold text-tertiary">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Audio</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span> System</div>
          </div>
       </div>
       
       <Button variant="danger" className="opacity-80 hover:opacity-100">Clear Cache (200MB)</Button>
    </SettingsLayout>
  );
};

export default DataSyncPage;
