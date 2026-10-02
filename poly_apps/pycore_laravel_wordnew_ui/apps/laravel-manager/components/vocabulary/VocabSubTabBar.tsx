
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Languages,
  BookOpen,
  ListChecks,
  Search,
  Newspaper,
  BookMarked
} from 'lucide-react';
import { SCROLL_X_HIDDEN_CLASS } from '../common/CenteredPageLayout';

export { SUBTAB_MOTION } from '@/core/ui/motion';

/** Sub-tab keys for the page. Active tab persists in localStorage. */
export type VocabTab = 'translate' | 'words' | 'libraries' | 'articles' | 'queue' | 'dictionary';
export const VOCAB_TAB_KEY = 'vocab_active_tab';
export const VOCAB_TABS: { key: VocabTab; Icon: React.FC<any> }[] = [
  { key: 'translate', Icon: Languages },
  { key: 'words', Icon: Search },
  { key: 'libraries', Icon: BookOpen },
  { key: 'articles', Icon: Newspaper },
  { key: 'queue', Icon: ListChecks },
  { key: 'dictionary', Icon: BookMarked },
];

interface VocabSubTabBarProps {
  activeTab: VocabTab;
  switchTab: (key: VocabTab) => void;
}

/** Sub-tab bar — one scrollable row (active tab kept in view); only the active tab's content mounts. Persisted in localStorage. */
const VocabSubTabBar: React.FC<VocabSubTabBarProps> = ({ activeTab, switchTab }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const target = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-nowrap gap-0.5 md:gap-1 mb-3 md:mb-4 border-b border-slate-200 dark:border-slate-700 ${SCROLL_X_HIDDEN_CLASS}`}
    >
      {VOCAB_TABS.map(({ key, Icon }) => (
        <button
          key={key}
          ref={activeTab === key ? activeRef : undefined}
          type="button"
          onClick={() => switchTab(key)}
          className={`relative shrink-0 whitespace-nowrap px-3 md:px-4 py-2 text-xs md:text-sm font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === key
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Icon className="w-4 h-4" /> {t(`vocabulary.tabs.${key}`)}
          {activeTab === key && (
            <motion.span
              layoutId="vocab-subtab"
              className="absolute left-0 right-0 bottom-0 h-0.5 bg-indigo-500"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
        </button>
      ))}
    </div>
  );
};

export default VocabSubTabBar;
