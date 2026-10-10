import { useCallback, useState } from 'react';
import type { Word } from '../../api/WfNewApiTypes';
import { wfNewSettings } from '../../WfNewSettingsStore';
import { awaitPlayableClip, wordClip } from '../../runtime-store/WfNewAudioCache';
import { CLIP_RESOLVE_WAIT_MS } from '../../constants/uiTiming';
import { wfNewStudyProgress } from './WfNewStudyProgress';
import { studyT } from './WfNewStudyLocales';

type Notify = (text: string, type: 'success' | 'warning') => void;

interface StudyActionsOptions {
  gid: string;
  groupLanguage?: string;
  lang: string;
  playPhoneticSpeech: (w: Word) => void;
  notify: Notify;
}

const isAbsoluteUrl = (u?: string): u is string => !!u && (u.startsWith('http://') || u.startsWith('https://'));

/** Shared study-surface actions: speak a word (real audio, else speech), mark Known / Forgot, large-font flag. */
export function useWfNewStudyActions({ gid, groupLanguage, lang, playPhoneticSpeech, notify }: StudyActionsOptions): {
  speakWord: (w: Word) => void;
  markWord: (w: Word, known: boolean) => void;
  largeFont: boolean;
  toggleLargeFont: () => void;
} {
  const [largeFont, setLargeFont] = useState<boolean>(() => !!wfNewSettings.get('wmLargeFont'));

  const speakWord = useCallback((w: Word) => {
    void awaitPlayableClip(wordClip(w.text, groupLanguage || 'en'), isAbsoluteUrl(w.audioUrl) ? w.audioUrl : null, CLIP_RESOLVE_WAIT_MS)
      .then((src) => {
        if (!src) {
          playPhoneticSpeech(w);
          return;
        }
        void new Audio(src).play().catch(() => playPhoneticSpeech(w));
      })
      .catch(() => playPhoneticSpeech(w));
  }, [groupLanguage, playPhoneticSpeech]);

  const markWord = useCallback((w: Word, known: boolean) => {
    wfNewStudyProgress.mark(gid, w, known, groupLanguage);
    notify(studyT(lang, known ? 'study.toast.known' : 'study.toast.forgot'), known ? 'success' : 'warning');
  }, [gid, groupLanguage, lang, notify]);

  const toggleLargeFont = useCallback(() => {
    const next = !wfNewSettings.get('wmLargeFont');
    wfNewSettings.setField('wmLargeFont', next);
    setLargeFont(next);
  }, []);

  return { speakWord, markWord, largeFont, toggleLargeFont };
}
