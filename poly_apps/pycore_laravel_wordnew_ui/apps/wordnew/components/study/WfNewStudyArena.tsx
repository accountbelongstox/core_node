import React from 'react';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { ElementTheme } from '../../WfNewThemes';
import type { Word } from '../../api/WfNewApiTypes';
import { studyT } from './WfNewStudyLocales';
import { wfNewStudyProgress } from './WfNewStudyProgress';
import { WfNewStudyWordList } from './WfNewStudyWordList';
import { WfNewPracticeControlPanel } from './WfNewPracticeControlPanel';

type ControlPanelProps = React.ComponentProps<typeof WfNewPracticeControlPanel>;

interface WfNewStudyArenaProps {
  open: boolean;
  locked?: boolean;
  onStop: () => void;
  trans: ControlPanelProps['trans'];
  lang: string;
  gid: string;
  sourceLanguage: string;
  theme: ElementTheme;
  words: Word[];
  loading: boolean;
  brief: boolean;
  autoScroll: boolean;
  favorites: Word[];
  activeWordId: string | null;
  recite: ControlPanelProps['recite'];
  pager: ControlPanelProps['pager'];
  largeFont: boolean;
  onToggleLargeFont: () => void;
  onSpeak: (w: Word) => void;
  onMark: (w: Word, known: boolean) => void;
  onToggleFavorite: (w: Word) => void;
  onOpenDetail: (w: Word) => void;
  onSelectWord: (index: number) => void;
  onToggleStats?: () => void;
  statsOpen?: boolean;
  children?: React.ReactNode;
}

export const WfNewStudyArena: React.FC<WfNewStudyArenaProps> = ({
  open, locked = false, onStop, trans, lang, gid, sourceLanguage, theme, words, loading, brief, autoScroll, favorites, activeWordId,
  recite, pager, largeFont, onToggleLargeFont, onSpeak, onMark, onToggleFavorite, onOpenDetail, onSelectWord,
  onToggleStats, statsOpen, children,
}) => (
  <ModalShell open={open} locked={locked} onClose={onStop} backdrop="black" cardClassName={null}>
    <div className="absolute inset-0 overflow-y-auto bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-32">
        <WfNewStudyWordList
          words={words}
          lang={lang}
          sourceLanguage={sourceLanguage}
          theme={theme}
          brief={brief}
          favorites={favorites}
          activeWordId={activeWordId}
          autoScroll={autoScroll}
          alwaysShowTranslation
          jumbo
          readCountOf={(w) => wfNewStudyProgress.recordOf(gid, w.id)?.rc ?? 0}
          emptyText={loading ? trans('practice.loadingWords') : studyT(lang, 'study.recite.empty')}
          onSpeak={onSpeak}
          onKnown={(w) => onMark(w, true)}
          onForgot={(w) => onMark(w, false)}
          onToggleFav={onToggleFavorite}
          onOpenDetail={onOpenDetail}
          onSelectWord={(_w, i) => onSelectWord(i)}
        />
      </div>
      <WfNewPracticeControlPanel
        trans={trans}
        recite={recite}
        pager={pager}
        largeFont={largeFont}
        onToggleLargeFont={onToggleLargeFont}
        onStop={onStop}
        docked
        onToggleStats={onToggleStats}
        statsOpen={statsOpen}
      />
      {children}
    </div>
  </ModalShell>
);
