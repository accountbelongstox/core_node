
import React from 'react';
import { SettingsLayout, SettingItem } from './Layout';

const AboutPage = () => {
  return (
    <SettingsLayout title="About">
       <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-2xl shadow-xl flex items-center justify-center text-3xl text-white font-bold mb-4">W</div>
          <h2 className="font-bold text-xl dark:text-white">WordFlow AI</h2>
          <p className="text-slate-500 text-sm">Version 1.0.0 (Build 2025.11)</p>
       </div>
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-2">Legal</div>
       <SettingItem label="Terms of Service" />
       <SettingItem label="Privacy Policy" />
       <SettingItem label="Open Source Licenses" />
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Connect</div>
       <SettingItem label="Website" value="wordflow.ai" />
       <SettingItem label="Twitter" value="@wordflow" />
       <SettingItem label="Contact Support" />
    </SettingsLayout>
  );
};

export default AboutPage;
