import React from 'react';
import { Volume2 } from 'lucide-react';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { absUrl } from '../utils/absUrl';

/** Small play-on-click button for a Laravel-relative (or absolute) audio url. */
const AudioButton: React.FC<{ url?: string }> = ({ url }) => {
  const { t } = useTranslation();
  if (!url) return null;
  const play = () => {
    const a = new Audio(absUrl(url));
    a.play().catch(() => undefined);
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
