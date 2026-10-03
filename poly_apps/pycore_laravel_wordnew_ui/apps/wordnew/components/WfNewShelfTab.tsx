/** WfNewShelfTab - the shelf tab body extracted from WfNewApp so the shell
 * stays under the 800-line modular limit. Pure presentation: state + handlers
 * come from the shell via props (prop names match the destructured hook bindings). */
import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';

import type { Word, WordGroup } from '../api';

import type { ElementTheme } from '../WfNewThemes';
import { CourseBlockCard } from './WfNewCards';

// Ported dictionary-study experience (recite loop / flashcards / review / stats)
// for the Default Vocabulary Group deep-dive. See ./study + docs/.
import { WfNewGroupStudyPanel } from './study/WfNewGroupStudyPanel';
import { useShelfPriorityBoost } from '../hooks/usePriorityBoost';
import { WfNewSectionHeader } from './WfNewSectionHeader';

interface WfNewShelfTabProps {
  activeTheme: ElementTheme; trans: (k: string, r?: Record<string, string|number>) => string;
  lang: string; gGroups: WordGroup[];
  selectedCourse: WordGroup | null; courseWords: Word[]; favorites: Word[];
  setSelectedPracticeGroup: (g: WordGroup | null) => void;
  selectBookCourse: (g: WordGroup) => Promise<void>;
  handleToggleFavorite: (w: Word) => void; playPhoneticSpeech: (w: Word) => void;
  setSelectedWordDetail: (w: Word | null) => void;
  onCloseGroup: () => void;
}

export const WfNewShelfTab: React.FC<WfNewShelfTabProps> = (props) => {
  const { activeTheme, trans, lang, gGroups, selectedCourse, courseWords, favorites, setSelectedPracticeGroup, selectBookCourse, handleToggleFavorite, playPhoneticSpeech, setSelectedWordDetail, onCloseGroup } = props;
  // Shelf courses are vocabulary groups: stack untranslated words when opened.
  const shelfWords = useMemo(
    () => courseWords
      .filter((w) => w.hasTranslation === false || !(w.translation || '').trim())
      .map((w) => w.text)
      .filter(Boolean),
    [courseWords],
  );
  const shelfLang = selectedCourse?.language || lang || 'en';
  useShelfPriorityBoost(selectedCourse?.id ?? null, {
    words: shelfWords,
    language: shelfLang,
  });
  return (
    <>
              {!selectedCourse ? (
                <>
                  <WfNewSectionHeader variant="page" title={trans('library.title')} subtitle={trans('library.subtitle')} />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {gGroups.map(g => (
                      <CourseBlockCard
                        key={g.id}
                        group={g}
                        theme={activeTheme}
                        onClick={() => selectBookCourse(g)}
                        lang={lang}
                        trans={trans}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Interactive Course deep-dive panel */
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        onCloseGroup();
                      }}
                      className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{selectedCourse.name}</h2>
                      <p className="text-zinc-500 text-xs">{trans('home.examineSub')}</p>
                    </div>
                  </div>

                  {/* Ported study experience: Browse / Cards / Recite / Review +
                      stats header, per-word reveal/pronounce/mark, and the Quiz
                      handoff. Words = already-loaded courseWords. */}
                  <WfNewGroupStudyPanel
                    group={selectedCourse}
                    words={courseWords}
                    lang={lang}
                    trans={trans}
                    theme={activeTheme}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFavorite}
                    playPhoneticSpeech={playPhoneticSpeech}
                    onOpenDetail={setSelectedWordDetail}
                    onStartQuiz={() => {
                      // R1 (§5.2): Start Quiz Arena defaults to list + sequential
                      // playback, NOT the multiple-choice quiz. The panel
                      // owns the mode/recite start (handleStartQuiz); here we only
                      // record the practice-group context. The quiz stays reachable
                      // as a manual mode switch (startModePractice still exists).
                      setSelectedPracticeGroup(selectedCourse);
                    }}
                  />
                </div>
              )}
    </>
  );
};
