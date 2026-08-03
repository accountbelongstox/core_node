/**
 * PcVocabularyPage is a self-contained direct-Laravel vocabulary surface.
 * Each tab uses the pycore-manager Laravel API boundary and owns local state.
 *
 * Tabs: Translate / Words / Libraries / Statistics / TTS Queue / Learning Tasks.
 * The active tab is persisted to localStorage. Every tab guards its own calls
 * and shows its own offline/error banner.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import {
  VOCAB_TABS, VOCAB_TAB_KEY, type VocabTabKey,
} from './vocabulary/vocabShared';
import VocabTranslateTab from './vocabulary/VocabTranslateTab';
import { StorageManager } from '../../../core/persistence';
import VocabWordsTab from './vocabulary/VocabWordsTab';
import VocabLibrariesTab from './vocabulary/VocabLibrariesTab';
import VocabStatisticsTab from './vocabulary/VocabStatisticsTab';
import VocabTtsQueueTab from './vocabulary/VocabTtsQueueTab';
import VocabLearningTasksPanel from './vocabulary/VocabLearningTasksPanel';

export default function PcVocabularyPage() {
  const { t } = useTranslation('pc');
  const [activeTab, setActiveTab] = useState<VocabTabKey>(() => {
    const saved = StorageManager.getRaw(VOCAB_TAB_KEY) as VocabTabKey | null;
    if (saved && VOCAB_TABS.some((t) => t.key === saved)) return saved;
    return 'words';
  });

  const switchTab = (key: VocabTabKey) => {
    setActiveTab(key);
    StorageManager.setRaw(VOCAB_TAB_KEY, key);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-sky-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-100">{t('vocabularyPage.title')}</h1>
          <p className="text-sm text-slate-400">{t('vocabularyPage.subtitle')}</p>
        </div>
      </header>

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-700/60 overflow-x-auto">
        {VOCAB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'translate' && <VocabTranslateTab />}
        {activeTab === 'words' && <VocabWordsTab />}
        {activeTab === 'libraries' && <VocabLibrariesTab />}
        {activeTab === 'statistics' && <VocabStatisticsTab />}
        {activeTab === 'tts-queue' && <VocabTtsQueueTab />}
        {activeTab === 'learning' && <VocabLearningTasksPanel />}
      </div>
    </div>
  );
}
