import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingItem } from './Layout';
import { Button, Icons } from '../../components/UI';
import { ApiTestingCenter } from '../../components/ApiTestingCenter';

const SettingsIndex = () => {
  const { navigate, user, logout } = useContext(AppContext);
  const [showApiTesting, setShowApiTesting] = useState(false);
  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up-fade">
       {/* Floating Title */}
       <div className="px-6 pt-12 pb-6 flex items-center justify-between">
          <h1 className="text-4xl font-serif text-slate-800 dark:text-white tracking-tight">Settings</h1>
          <button onClick={() => navigate('home')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
            <Icons.Close />
          </button>
       </div>
       
       <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar max-w-lg mx-auto w-full">
         {/* Profile Card */}
         <div 
            className="holo-card p-6 rounded-[2.5rem] flex items-center gap-5 mb-10 cursor-pointer group relative overflow-hidden border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/40" 
            onClick={() => navigate('profile')}
         >
           <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-colors"></div>
           
           <div className="relative p-1 rounded-full border border-blue-500/30 dark:border-white/20">
             <img src={user?.avatar} className="w-16 h-16 rounded-full" />
           </div>
           <div className="relative z-10">
              <div className="font-serif font-bold text-2xl text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors">{user?.name}</div>
              <div className="text-blue-500 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mt-1 glow-text">{user?.isPro ? 'Pro Member' : 'Free Plan'}</div>
           </div>
           <div className="ml-auto text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
              <Icons.Edit />
           </div>
         </div>

         <div className="space-y-4">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-4 mb-1">Preferences</div>
           <SettingItem label="Language & Audio" value="En" onClick={() => navigate('settings_lang')} />
           <SettingItem label="Learning Goals" value="20/day" onClick={() => navigate('settings_learning')} />
           <SettingItem label="Display & Theme" value="Auto" onClick={() => navigate('settings_display')} />

           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-4 mt-8 mb-1">System</div>
           <SettingItem label="API Server" value="Auto" onClick={() => navigate('settings_api_server')} />
           <SettingItem label="API Testing Center" value="" onClick={() => setShowApiTesting(true)} />
           <SettingItem label="Notifications" value="On" onClick={() => navigate('settings_notifications')} />
           <SettingItem label="Data & Sync" value="Active" onClick={() => navigate('settings_data')} />
           <SettingItem label="Privacy & Security" value="" onClick={() => navigate('settings_privacy')} />
           <SettingItem label="About" value="v1.0" onClick={() => navigate('settings_about')} />
         </div>

         <div className="mt-12 px-2">
            <Button variant="danger" className="opacity-80 hover:opacity-100" onClick={logout}>Sign Out</Button>
            <p className="text-center text-xs text-slate-400 mt-6 font-mono opacity-50">ID: {user?.id} • BUILT WITH GEMINI</p>
         </div>
       </div>

       {/* API Testing Center Modal */}
       {showApiTesting && (
         <ApiTestingCenter onClose={() => setShowApiTesting(false)} />
       )}
    </div>
  );
};

export default SettingsIndex;