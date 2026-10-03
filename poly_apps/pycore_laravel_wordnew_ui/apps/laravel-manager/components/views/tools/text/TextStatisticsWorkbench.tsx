/** Text statistics: a writing surface with live stat tiles, reading time by pace and a top-words frequency list. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, Paper, PaperTextarea, Segmented, SoftButton, Tile, ToggleChip, prefillBool, prefillNumber, prefillString, useDebounced, useToolRecord } from './textKit';
import { analyzeText, minutesToClock } from './logic/statsLogic';

const DEBOUNCE_MS = 120;
const READING_PACES = [150, 200, 250] as const;
const SPEAKING_WPM = 150;
const TOP_WORDS = 10;
const SAMPLE = 'Writing is thinking made visible. A good sentence carries one idea; a good paragraph carries one argument.\n\nCount the words, trim the filler, and read it aloud. If you stumble, your reader will too.';

const TextStatisticsWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [text, setText] = useState(() => prefillString(lastRun, 'text', SAMPLE));
  const [pace, setPace] = useState<number>(() => prefillNumber(lastRun, 'pace', 200));
  const [skipStopWords, setSkipStopWords] = useState(() => prefillBool(lastRun, 'skipStopWords', true));
  const live = useDebounced(text, DEBOUNCE_MS);
  const stats = useMemo(() => analyzeText(live, skipStopWords, TOP_WORDS), [live, skipStopWords]);

  const spaces = stats.characters - stats.charactersNoSpaces;
  const other = Math.max(0, stats.charactersNoSpaces - stats.letters - stats.digits - stats.punctuation);
  const composition = [
    { key: 'letters', value: stats.letters, tone: 'bg-violet-500' },
    { key: 'digits', value: stats.digits, tone: 'bg-sky-500' },
    { key: 'punctuation', value: stats.punctuation, tone: 'bg-amber-500' },
    { key: 'spaces', value: spaces, tone: 'bg-stone-300 dark:bg-slate-600' },
    { key: 'other', value: other, tone: 'bg-rose-400' },
  ];
  const maxCount = stats.topWords[0]?.count ?? 1;

  const formatTime = (minutes: number): string => {
    const { minutes: m, seconds } = minutesToClock(minutes);
    return m > 0 ? t('toolsText.stats.time_ms', { m, s: seconds }) : t('toolsText.stats.time_s', { s: seconds });
  };
  const readingMinutes = stats.words / pace;
  const speakingMinutes = stats.words / SPEAKING_WPM;
  const summary = [
    ['words', stats.words], ['characters', stats.characters], ['characters_no_spaces', stats.charactersNoSpaces], ['sentences', stats.sentences],
    ['paragraphs', stats.paragraphs], ['lines', stats.lines],
  ].map(([key, value]) => `${t(`toolsText.stats.${key}`)}: ${value}`).concat(`${t('toolsText.stats.reading_time')}: ${formatTime(readingMinutes)}`).join('\n');

  return (
    <Desk wide>
      <div className="grid gap-4 lg:grid-cols-5">
        <Paper
          className="lg:col-span-3"
          title={t('toolsText.stats.editor')}
          actions={(
            <>
              <SoftButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => setText('')}>{t('uiTools.common.clear')}</SoftButton>
              <CopyButton text={summary} label={t('toolsText.stats.copy_summary')} onCopied={() => record({ text, pace, skipStopWords }, { words: stats.words, characters: stats.characters })} />
            </>
          )}
        >
          <PaperTextarea serif autoGrow rows={16} value={text} onChange={setText} ariaLabel={t('toolsText.stats.editor')} placeholder={t('toolsText.stats.placeholder')} className="min-h-[22rem]" />
          <p className="mt-2 text-right font-mono text-[11px] text-slate-400">{t('toolsText.stats.footer', { words: stats.words, chars: stats.characters })}</p>
        </Paper>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Tile accent label={t('toolsText.stats.words')} value={stats.words.toLocaleString()} hint={t('toolsText.stats.unique', { n: stats.uniqueWords })} />
            <Tile label={t('toolsText.stats.characters')} value={stats.characters.toLocaleString()} hint={t('toolsText.stats.no_spaces', { n: stats.charactersNoSpaces })} />
            <Tile label={t('toolsText.stats.sentences')} value={stats.sentences.toLocaleString()} />
            <Tile label={t('toolsText.stats.paragraphs')} value={stats.paragraphs.toLocaleString()} hint={t('toolsText.stats.lines_hint', { n: stats.lines })} />
            <Tile label={t('toolsText.stats.reading_time')} value={formatTime(readingMinutes)} />
            <Tile label={t('toolsText.stats.speaking_time')} value={formatTime(speakingMinutes)} />
          </div>
          <Paper title={t('toolsText.stats.pace')}>
            <Segmented value={pace} onChange={(next) => setPace(next)} ariaLabel={t('toolsText.stats.pace')} options={READING_PACES.map((wpm) => ({ value: wpm, label: t('toolsText.stats.wpm', { n: wpm }) }))} />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('toolsText.stats.avg_word')}</dt><dd className="font-mono text-base font-bold text-slate-800 dark:text-slate-100">{stats.avgWordLength}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('toolsText.stats.bytes')}</dt><dd className="font-mono text-base font-bold text-slate-800 dark:text-slate-100">{stats.bytes.toLocaleString()}</dd></div>
              <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('toolsText.stats.longest')}</dt><dd className="truncate font-mono text-base font-bold text-slate-800 dark:text-slate-100">{stats.longestWord || '-'}</dd></div>
            </dl>
          </Paper>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Paper title={t('toolsText.stats.composition')}>
          <div className="flex h-3 overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800" role="img" aria-label={t('toolsText.stats.composition')}>
            {composition.filter((part) => part.value > 0).map((part) => <div key={part.key} className={part.tone} style={{ width: `${(part.value / Math.max(1, stats.characters)) * 100}%` }} />)}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {composition.map((part) => (
              <li key={part.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span className={`h-2.5 w-2.5 rounded-full ${part.tone}`} />{t(`toolsText.stats.kind_${part.key}`)}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{part.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Paper>

        <Paper title={t('toolsText.stats.top_words')} actions={<ToggleChip active={skipStopWords} onClick={() => setSkipStopWords((value) => !value)}>{t('toolsText.stats.skip_stop_words')}</ToggleChip>}>
          {stats.topWords.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t('toolsText.stats.no_words')}</p>
          ) : (
            <ol className="space-y-1.5">
              {stats.topWords.map((entry) => (
                <li key={entry.word} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
                  <span className="truncate font-mono font-semibold text-slate-700 dark:text-slate-200">{entry.word}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-violet-500" style={{ width: `${(entry.count / maxCount) * 100}%` }} /></span>
                  <span className="w-16 text-right font-mono text-slate-500">{entry.count} <span className="text-slate-400">({Math.round(entry.share * 100)}%)</span></span>
                </li>
              ))}
            </ol>
          )}
        </Paper>
      </div>
    </Desk>
  );
};

export default TextStatisticsWorkbench;
