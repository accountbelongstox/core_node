import React from 'react';
import { Languages } from 'lucide-react';
import { NoticeBanner } from '@/shared/ui/NoticeBanner';

interface Props {
  /** Sentence language -> how many sentences have no text in it (see `orchSkippedLanguages`). */
  skipped: Readonly<Record<string, number>> | null | undefined;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  className?: string;
}

/** Tells which pattern languages the book lacks (their steps are skipped) and why a bilingual book is preferred. */
export const WordNewOrchMissingLanguageNotice: React.FC<Props> = ({ skipped, trans, className = '' }) => {
  const rows = Object.entries(skipped ?? {}).filter(([, count]) => count > 0);
  if (rows.length === 0) return null;
  return (
    <NoticeBanner icon={Languages} className={className}>
      {rows.map(([lang, count]) => (
        <p key={lang}>{trans('orchCompose.missingLang.notice', { count, language: trans(`orchCompose.langName.${lang}`) })}</p>
      ))}
      <p className="mt-1 opacity-80">{trans('orchCompose.missingLang.advice')}</p>
    </NoticeBanner>
  );
};
