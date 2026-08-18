
import React from 'react';
import { motion } from 'framer-motion';
import {
  Languages,
  BookOpen,
  ListChecks,
  Search,
  Newspaper
} from 'lucide-react';

export { SUBTAB_MOTION } from '@/core/ui/motion';

/** Sub-tab keys for the page. Active tab persists in localStorage. */
export type VocabTab = 'translate' | 'words' | 'libraries' | 'articles' | 'queue';
export const VOCAB_TAB_KEY = 'vocab_active_tab';
export const VOCAB_TABS: { key: VocabTab; label: string; Icon: React.FC<any> }[] = [
  { key: 'translate', label: 'Translate', Icon: Languages },
  { key: 'words', label: 'Words', Icon: Search },
  { key: 'libraries', label: 'Libraries', Icon: BookOpen },
  { key: 'articles', label: 'Articles', Icon: Newspaper },
  { key: 'queue', label: 'TTS Queue', Icon: ListChecks },
];

interface VocabSubTabBarProps {
  activeTab: VocabTab;
  switchTab: (key: VocabTab) => void;
}

/** Sub-tab bar — only the active tab's content mounts. Persisted in localStorage. */
const VocabSubTabBar: React.FC<VocabSubTabBarProps> = ({ activeTab, switchTab }) => (
  <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
    {VOCAB_TABS.map(({ key, label, Icon }) => (
      <button
        key={key}
        type="button"
        onClick={() => switchTab(key)}
        className={`relative px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
          activeTab === key
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <Icon className="w-4 h-4" /> {label}
        {activeTab === key && (
          <motion.span
            layoutId="vocab-subtab"
            className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-500"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
      </button>
    ))}
  </div>
);

export default VocabSubTabBar;
