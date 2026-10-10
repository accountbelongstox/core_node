import React from 'react';
import { Volume2 } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { absUrl } from '../utils/absUrl';
import { playSharedAudio } from '../utils/audioPlayback';
import { useToast } from './admin';

/** Small play-on-click button for a Laravel-relative (or absolute) audio url. */
const AudioButton: React.FC<{ url?: string }> = ({ url }) => {
  const { t } = useTranslation();
  const toast = useToast();
  if (!url) return null;
  const play = () => {
    playSharedAudio(absUrl(url)).catch(() => toast.error(t('vocabulary.audio_play_failed')));
  };
  return (
    <button
      onClick={play}
      title={t('uiVocab.audioButton.play')}
      className="p-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20"
    >
      <Volume2 className="w-4 h-4" />
    </button>
  );
};

export default AudioButton;
