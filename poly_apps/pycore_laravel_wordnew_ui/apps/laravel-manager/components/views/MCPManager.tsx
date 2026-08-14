import React, { useState } from 'react';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import { Image, ListTodo, ImagePlus, Settings, Eye } from 'lucide-react';
import OcrTab from './mcp/OcrTab';
import PlaceholderTab from './mcp/PlaceholderTab';
import ScreenshotsTab from './mcp/ScreenshotsTab';
import SettingsTab from './mcp/SettingsTab';
import TasksTab from './mcp/TasksTab';
import VoiceTab from './mcp/VoiceTab';

type MCPTab = 'screenshots' | 'tasks' | 'placeholder' | 'voice' | 'ocr' | 'settings';

interface MCPManagerProps {
  lang?: Language;
  /**
   * When provided, only these tabs are shown (and the first becomes active).
   * Used to embed a SUBSET of MCP features inside other views after the
   * standalone #/mcp tab was removed: Task Center embeds ['tasks','settings'],
   * Tools embeds ['screenshots','placeholder']. Omit for the full manager.
   */
  allowedTabs?: MCPTab[];
}

/**
 * MCP Manager — thin tab shell. Each tab is a self-contained component under
 * ./mcp/ that owns its own state/effects/handlers and reuses components/common
 * + hooks. This container only renders the segmented tab control and mounts the
 * active tab (optionally restricted to `allowedTabs` when embedded elsewhere).
 */
const MCPManager: React.FC<MCPManagerProps> = ({ lang = 'en', allowedTabs }) => {
  const t = TRANSLATIONS[lang].mcp;
  const [activeTab, setActiveTab] = useState<MCPTab>(allowedTabs && allowedTabs.length > 0 ? allowedTabs[0] : 'screenshots');

  const tabs = [
    { id: 'screenshots' as MCPTab, label: t.tabs.screenshots, icon: Image },
    { id: 'tasks' as MCPTab, label: t.tabs.tasks, icon: ListTodo },
    { id: 'placeholder' as MCPTab, label: t.tabs.placeholder, icon: ImagePlus },
    { id: 'voice' as MCPTab, label: t.tabs.voice, icon: Settings },
    { id: 'ocr' as MCPTab, label: t.tabs.ocr, icon: Eye },
    { id: 'settings' as MCPTab, label: t.tabs.settings, icon: Settings },
  ];

  // When embedded in another view, show only the allowed subset of tabs.
  const visibleTabs = allowedTabs ? tabs.filter((tb) => allowedTabs.includes(tb.id)) : tabs;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs — segmented pill control */}
      <div className="mb-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'screenshots' && <ScreenshotsTab lang={lang} />}
        {activeTab === 'tasks' && <TasksTab lang={lang} />}
        {activeTab === 'placeholder' && <PlaceholderTab lang={lang} />}
        {activeTab === 'voice' && <VoiceTab lang={lang} />}
        {activeTab === 'ocr' && <OcrTab lang={lang} />}
        {activeTab === 'settings' && <SettingsTab lang={lang} />}
      </div>
    </div>
  );
};

export default MCPManager;
