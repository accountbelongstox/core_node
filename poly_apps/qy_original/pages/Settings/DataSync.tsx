
import React from 'react';
import { SettingsLayout, SettingItem } from './Layout';
import { Button } from '../../components/UI';

const DataSyncPage = () => {
  return (
    <SettingsLayout title="Data & Sync">
       <SettingItem label="Auto Sync" type="toggle" active={true} />
       <SettingItem label="Sync only on Wi-Fi" type="toggle" active={true} />
       <SettingItem label="Last Backup" value="Today, 10:00 AM" />
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Storage</div>
       <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl mb-4">
          <div className="flex justify-between text-sm mb-2 dark:text-white"><span>Used Storage</span><span>430 MB</span></div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
             <div className="bg-blue-500 h-full w-1/3"></div>
          </div>
       </div>
       <Button variant="secondary" className="text-red-500 border-red-200">Clear Cache (200MB)</Button>
    </SettingsLayout>
  );
};

export default DataSyncPage;
