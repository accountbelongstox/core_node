import React from 'react';
import { Volume2 } from 'lucide-react';
import { absUrl } from '../../core/utils/absUrl';

/** Small play-on-click button for a Laravel-relative (or absolute) audio url. */
const AudioButton: React.FC<{ url?: string }> = ({ url }) => {
  if (!url) return null;
  const play = () => {
    const a = new Audio(absUrl(url));
    a.play().catch(() => undefined);
  };
  return (
    <button
      onClick={play}
      title="Play"
      className="p-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20"
    >
      <Volume2 className="w-4 h-4" />
    </button>
  );
};

export default AudioButton;
