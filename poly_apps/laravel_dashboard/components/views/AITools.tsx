import React, { useState } from 'react';
import {
  Sparkles,
  Languages,
  Volume2,
  FileImage,
  FileText,
  Menu,
  X as CloseIcon
} from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { commonClasses } from '../../styles/theme';

// Import new centralized architecture components
import TranslationForm from '../examples/TranslationForm';
import TTSForm from '../tools/TTSForm';
import OCRForm from '../tools/OCRForm';
import PromptForm from '../tools/PromptForm';

type ToolView = 'translation' | 'tts' | 'ocr' | 'prompts';

const AITools: React.FC = () => {
  const { lang } = useAppState();
  const [currentView, setCurrentView] = useState<ToolView>('translation');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Navigation items
  const navigationItems = [
    {
      id: 'translation' as ToolView,
      icon: Languages,
      label: 'AI Translation',
      description: 'Translate text between languages',
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 'tts' as ToolView,
      icon: Volume2,
      label: 'Text-to-Speech',
      description: 'Convert text to speech',
      color: 'from-green-500 to-teal-600'
    },
    {
      id: 'ocr' as ToolView,
      icon: FileImage,
      label: 'OCR',
      description: 'Extract text from images',
      color: 'from-orange-500 to-red-600'
    },
    {
      id: 'prompts' as ToolView,
      icon: FileText,
      label: 'Prompt Manager',
      description: 'Manage AI prompts',
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'translation':
        return <TranslationForm />;
      case 'tts':
        return <TTSForm />;
      case 'ocr':
        return <OCRForm />;
      case 'prompts':
        return <PromptForm />;
      default:
        return <TranslationForm />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <div
        className={`
          ${sidebarOpen ? 'w-80' : 'w-16'}
          transition-all duration-300 bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          flex flex-col
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">AI Tools</h2>
                <p className="text-xs text-slate-500">Powered by AI</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {sidebarOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`
                  w-full flex items-start gap-3 p-3 rounded-lg mb-2
                  transition-all duration-200
                  ${
                    isActive
                      ? 'bg-gradient-to-br ' + item.color + ' text-white shadow-lg scale-105'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                title={sidebarOpen ? undefined : item.label}
              >
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                    ${
                      isActive
                        ? 'bg-white/20'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {sidebarOpen && (
                  <div className="flex-1 text-left">
                    <div className="font-semibold">{item.label}</div>
                    <div className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-sm">AI Tools Suite</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Advanced AI-powered tools for translation, speech synthesis, OCR, and prompt management.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default AITools;
