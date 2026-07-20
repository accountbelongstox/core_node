/**
 * WfNewNoTranslation — a tiny muted marker shown where a study word has no
 * translation (word.translation === ''). A greyed lucide Languages icon + a
 * short italic label, carrying an accessible title/tooltip meaning "no
 * translation available". Replaces the old '—' gloss fallback so an empty
 * translation reads as a real state, not a dash.
 */
import React from 'react';
import { Languages } from 'lucide-react';
import { translate } from '../../WfNewLocales';

interface WfNewNoTranslationProps {
  lang: string;
  /** Hide the text label and show the icon only (tight rows). */
  iconOnly?: boolean;
  className?: string;
}

export const WfNewNoTranslation: React.FC<WfNewNoTranslationProps> = ({
  lang,
  iconOnly = false,
  className,
}) => {
  const label = translate(lang, 'study.noTranslation');
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-zinc-600 ${className ?? ''}`}
    >
      <Languages className="w-3 h-3 shrink-0 opacity-70" />
      {!iconOnly && <span className="text-[11px] font-mono italic">{label}</span>}
    </span>
  );
};
