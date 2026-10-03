/** Side sheet of one vocabulary library: coverage stats and a paged, playable word list. */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Languages, Play, Volume2 } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { callToolApi } from '../toolRunner';
import { IconBtn, Notice, Pager, Sheet, StatusDot } from './opsKit';
import { useRemote } from './opsHooks';
import { pickTranslation } from './opsLogic';
import type { LibraryRow, LibraryWordsData } from './opsTypes';

const PAGE_SIZE = 40;

interface LibraryWordsSheetProps {
  library: LibraryRow | null;
  onClose: () => void;
}

const LibraryWordsSheet: React.FC<LibraryWordsSheetProps> = ({ library, onClose }) => {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const libraryId = library?.id ?? null;
  const words = useRemote(
    () => callToolApi<LibraryWordsData>('appQyV1.getLibraryWordsPage', { libraryId, page, per_page: PAGE_SIZE }),
    [libraryId, page],
    libraryId !== null,
  );
  const preferred = [i18n.language.split('-')[0], 'zh', 'en'];
  const data = words.data;
  const stats = data?.stats;

  const play = (url: string): void => {
    if (!audioRef.current) return;
    audioRef.current.src = laravelMediaUrl(url);
    void audioRef.current.play().catch(() => undefined);
  };

  const coverage = (label: string, done: number | undefined): React.ReactNode => (
    <div className="min-w-0">
      <div className="mb-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>{label}</span><span className="tabular-nums">{done ?? 0} / {stats?.total ?? 0}</span></div>
      <ProgressBar done={done ?? 0} total={stats?.total ?? 0} tone="rose" />
    </div>
  );

  return (
    <Sheet
      open={library !== null}
      onClose={() => { onClose(); setPage(1); }}
      title={library?.name ?? ''}
      subtitle={t('toolsOps.library.sheet_subtitle', { count: library?.word_count ?? 0, language: library?.language ?? '-' })}
      footer={data ? <Pager page={page} pages={data.pagination.last_page} onChange={setPage} accent="rose" summary={t('toolsOps.library.words_range', { total: data.pagination.total })} /> : undefined}
    >
      <audio ref={audioRef} className="hidden" />
      {words.error && <Notice tone="error">{words.error}</Notice>}
      {stats && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {coverage(t('toolsOps.library.cov_translated'), stats.translated)}
          {coverage(t('toolsOps.library.cov_audio'), stats.with_audio)}
          {coverage(t('toolsOps.library.cov_image'), stats.with_image)}
        </div>
      )}
      {words.loading && !data ? (
        <p className="py-10 text-center text-sm text-slate-400">{t('toolsOps.common.loading')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {(data?.words ?? []).map((word) => {
            const translation = pickTranslation(word.translations, preferred);
            const phonetic = word.us_phonetic || word.phonetic || word.uk_phonetic;
            return (
              <li key={word.md5 ?? word.index} className="flex items-center gap-3 py-2.5">
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{word.index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{word.word}</span>
                    {phonetic && <span className="truncate font-mono text-[11px] text-slate-400">/{phonetic}/</span>}
                    {word.is_valid === false && <Pill tone="rose" tint>{t('toolsOps.library.invalid')}</Pill>}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{translation || t('toolsOps.library.no_translation')}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-slate-300 dark:text-slate-600">
                  <Languages className="h-3.5 w-3.5" aria-hidden />
                  <StatusDot on={Boolean(word.has_translation)} title={t('toolsOps.library.cov_translated')} />
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                  <StatusDot on={Boolean(word.has_image)} title={t('toolsOps.library.cov_image')} />
                  {word.audio_url ? <IconBtn icon={Play} title={t('uiTools.common.play')} accent="rose" onClick={() => play(word.audio_url as string)} /> : <Volume2 className="h-4 w-4 opacity-40" aria-hidden />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
};

export default LibraryWordsSheet;
