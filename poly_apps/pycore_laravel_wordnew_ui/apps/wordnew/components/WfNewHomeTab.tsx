/** WfNewHomeTab - the home tab body extracted from WfNewApp so the shell
 * stays under the 800-line modular limit. Pure presentation: state + handlers
 * come from the shell via props (prop names match the destructured hook bindings). */
import React from 'react';
import { Volume2, Play, Languages, BarChart2, AudioLines, Users, GalleryVerticalEnd, SpellCheck, Headphones, BookOpenText } from 'lucide-react';

import { DEFAULT_VOCAB_GROUP_NAME } from '../api';
import type { WordGroup, BentoGroup, WfNewContentGroup, WfNewHomeContent, WfNewLanguage } from '../api';
import type { ElementTheme } from '../WfNewThemes';
import type { UserStats } from '../api/WfNewApiTypes';
import { wfNewSettings } from '../WfNewSettingsStore';
import { WfNewHomeContent as WfNewHomeContentWidget } from './WfNewHomeContent';
import { WfNewContentGroupCard } from './WfNewContentGroupCard';
import { WfNewHomeDashboard } from './WfNewHomeDashboard';
import { WfNewHomeLabCard } from './WfNewHomeLabCard';
import { WfNewHomeDefaultGroupCard } from './WfNewHomeDefaultGroupCard';
import { WfNewSectionHeader } from './WfNewSectionHeader';
import { WordNewDailyReadingSection } from './daily-reading/WordNewDailyReadingSection';
import { dailyReadingHash } from '../routing/WordNewHashRoutes';
import { cancelSpeech } from '../utils/WordNewSpeech';

const HOME_LAB_CARDS = [
  { tab: 'walkman', accent: 'indigo', icon: Volume2, iconClassName: 'animate-pulse', title: 'home.walkmanTitle', desc: 'home.walkmanDesc' },
  { tab: 'subtitles', accent: 'fuchsia', icon: Play, title: 'home.subsTitle', desc: 'home.subsDesc' },
  { tab: 'bilingual', accent: 'amber', icon: Languages, title: 'home.bilingualTitle', desc: 'home.bilingualDesc' },
  { tab: 'orch-audio', accent: 'cyan', icon: AudioLines, title: 'home.orchAudioTitle', desc: 'home.orchAudioDesc' },
  { tab: 'stats', accent: 'emerald', icon: BarChart2, title: 'home.statsTitle', desc: 'home.statsDesc' },
  { tab: 'social', accent: 'rose', icon: Users, title: 'nav.social', desc: 'home.socialDesc' },
] as const;

const HOME_MODE_CARDS = [
  { id: 'study', accent: 'fuchsia', icon: GalleryVerticalEnd, title: 'modes.flashcards', desc: 'home.modeStudyDesc' },
  { id: 'quiz', accent: 'emerald', icon: SpellCheck, title: 'modes.quiz', desc: 'home.modeQuizDesc' },
  { id: 'listening', accent: 'amber', icon: Headphones, title: 'modes.listening', desc: 'home.modeListenDesc' },
  { id: 'reading', accent: 'blue', icon: BookOpenText, title: 'modes.reading', desc: 'home.modeReadDesc' },
] as const;

interface WfNewHomeTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  lang: string;
  dark: boolean; currentUser: any; nickname: string;
  gGroups: WordGroup[]; bentoGroups: BentoGroup[]; userStats: UserStats;
  languageOptions: WfNewLanguage[]; homeContent: WfNewHomeContent; homeContentLoading: boolean;
  addToast: (t: string, ty?: any) => void; setActiveTab: (t: any) => void;
  setContentListKind: (k: any) => void;
  handleSaveDashboard: (n: any) => Promise<void>;
  openHomeGroup: (g: WfNewContentGroup) => void;
  loadMoreGroups: (k: any) => Promise<boolean>;
  selectBookCourse: (g: WordGroup) => Promise<void>;
  startGroupPractice: (g: WordGroup, m: any) => Promise<void>;
  startModePractice: (m: any) => void;
  addLibraryToStudy: (g: WfNewContentGroup) => void;
  openWordGroupList: () => void;
}

export const WfNewHomeTab: React.FC<WfNewHomeTabProps> = (props) => {
  const { activeTheme, trans, lang, dark, currentUser, nickname, gGroups, bentoGroups, userStats, languageOptions, homeContent, homeContentLoading, addToast, setActiveTab, setContentListKind, handleSaveDashboard, openHomeGroup, loadMoreGroups, selectBookCourse, startGroupPractice, startModePractice, addLibraryToStudy, openWordGroupList } = props;

  return (
    <>
              {/* Collapsible learning panel hanging from the header. Collapsed: core
                  figures (logged in) or the shared login (logged out). Expanded:
                  the full stats bento and the settings row (Save routes to login
                  when logged out). */}
              <WfNewHomeDashboard
                activeTheme={activeTheme}
                trans={trans}
                lang={lang}
                isLoggedIn={currentUser.isLoggedIn}
                nickname={nickname}
                groupName={gGroups[0]?.name || ''}
                groupCount={gGroups[0]?.count || 0}
                targetLang={currentUser.targetLang || wfNewSettings.get('settingTargetLang')}
                dailyGoal={userStats.dailyGoal}
                languageOptions={languageOptions}
                onSave={handleSaveDashboard}
                onOpenGroup={() => {
                  const group = gGroups[0];
                  if (!group) return;
                  setActiveTab('shelf');
                  void selectBookCourse(group);
                }}
              />

              {/* Omni-Symmetrical Audio-Visual Laboratory */}
              <div className="space-y-3.5 pt-4 animate-fade-in">
                <WfNewSectionHeader variant="bar" title={trans('home.labsHeader')} />
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
                  {HOME_LAB_CARDS.map((card) => (
                    <WfNewHomeLabCard
                      key={card.tab}
                      theme={activeTheme}
                      accent={card.accent}
                      icon={card.icon}
                      iconClassName={'iconClassName' in card ? card.iconClassName : undefined}
                      title={trans(card.title)}
                      description={trans(card.desc)}
                      onOpen={() => {
                        setActiveTab(card.tab);
                        cancelSpeech();
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Quantum Recitation Portal modes */}
              <div className="space-y-3.5 pt-4">
                <WfNewSectionHeader variant="bar" title={trans('home.modesHeader')} />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {HOME_MODE_CARDS.map((mode) => (
                    <WfNewHomeLabCard
                      key={mode.id}
                      theme={activeTheme}
                      accent={mode.accent}
                      icon={mode.icon}
                      layout="row"
                      title={trans(mode.title)}
                      description={trans(mode.desc)}
                      onOpen={() => {
                        const g = gGroups[0] || bentoGroups[0];
                        if (g) {
                          void startGroupPractice(g, mode.id);
                        } else {
                          setActiveTab('practice');
                          startModePractice(mode.id);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Word Groups uses the original dossier artwork as one full-width block. */}
              <div className="space-y-4 pt-4">
                <WfNewSectionHeader
                  title={trans('content.section.word')}
                  subtitle={trans('home.dossiersDesc')}
                  action={{ label: trans('home.allPacks'), onClick: openWordGroupList }}
                />

                {/* The canonical Default Vocabulary Group owns the complete row. */}
                <div className="grid grid-cols-1 gap-6 auto-rows-auto">
                  {bentoGroups.filter((group) => group.name === DEFAULT_VOCAB_GROUP_NAME).map((group, idx) => (
                    <WfNewHomeDefaultGroupCard
                      key={group.id}
                      group={group}
                      index={idx}
                      dark={dark}
                      activeTheme={activeTheme}
                      trans={trans}
                      onOpen={() => {
                        setActiveTab('shelf');
                        void selectBookCourse(group);
                      }}
                      onEnroll={() => addToast(trans('toast.pinned', { name: group.name }), 'success')}
                    />
                  ))}
                </div>

                {/* Remaining word groups stay below the full-width default group. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {homeContent.words
                    .filter((group) => group.title !== DEFAULT_VOCAB_GROUP_NAME)
                    .map((group) => (
                      <WfNewContentGroupCard
                        key={`${group.kind}-${group.id}`}
                        group={group}
                        theme={activeTheme}
                        trans={trans}
                        onClick={() => openHomeGroup(group)}
                        fullWidth
                      />
                    ))}
                </div>
              </div>

              {/* Daily Reading stays directly below Word Groups. Playback opens
                  the dedicated article route instead of becoming a header action. */}
              <WordNewDailyReadingSection
                theme={activeTheme}
                trans={trans}
                onOpenPage={(articleId) => {
                  setActiveTab('daily-reading');
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', dailyReadingHash(articleId));
                  }
                }}
                onOpenBook={(sourceKey, title) => openHomeGroup({
                  id: sourceKey,
                  kind: 'book',
                  sourceKey,
                  title,
                  count: 0,
                  countUnit: 'sentences',
                  category: 'daily',
                })}
              />

              {/* Multi-category content hub — live backend word / book / subtitle
                  / document groups (WfNewHomeContent widget reads getHomeContent). */}
              <WfNewHomeContentWidget
                content={homeContent}
                loading={homeContentLoading}
                theme={activeTheme}
                trans={trans}
                onOpen={openHomeGroup}
                onMore={(kind) => { setContentListKind(kind); setActiveTab('content-list'); }}
                onNeedMore={loadMoreGroups}
                onAddToStudy={addLibraryToStudy}
              />
    </>
  );
};
