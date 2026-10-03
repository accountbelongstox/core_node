/** Emoji picker: searchable category grid, click-to-copy, a composer tray and a detail card with code points. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, FOCUS_RING, Paper, SoftButton, useCopy, useDebounced, useToolRecord } from './textKit';
import { EMOJI_CATEGORIES, EMOJI_LIST, searchEmoji, type EmojiCategory, type EmojiEntry } from './logic/emojiData';

const RECENT_LIMIT = 16;
const TRAY_LIMIT = 200;
const CATEGORY_ICON: Record<EmojiCategory, string> = {
  smileys: '😀', people: '👋', animals: '🐶', food: '🍕', travel: '🚀', activities: '⚽', objects: '💡', symbols: '❤️', flags: '🏁',
};
let recentEmoji: string[] = [];

const codePoints = (emoji: string): string => Array.from(emoji).map((char) => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

const EmojiPickerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const { copiedKey, copy } = useCopy();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EmojiCategory | 'all'>('all');
  const [tray, setTray] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(recentEmoji);
  const [focused, setFocused] = useState<EmojiEntry | null>(null);
  const debounced = useDebounced(query, 80);

  const results = useMemo(() => searchEmoji(debounced, category), [debounced, category]);
  const trayText = tray.join('');
  const detail = focused ?? results[0] ?? null;

  const pick = (entry: EmojiEntry): void => {
    void copy(entry.emoji, entry.emoji);
    setTray((current) => [...current, entry.emoji].slice(-TRAY_LIMIT));
    recentEmoji = [entry.emoji, ...recentEmoji.filter((item) => item !== entry.emoji)].slice(0, RECENT_LIMIT);
    setRecent(recentEmoji);
    setFocused(entry);
  };
  const findEntry = (emoji: string): EmojiEntry | undefined => EMOJI_LIST.find((entry) => entry.emoji === emoji);

  return (
    <Desk wide>
      <Paper title={t('toolsText.emoji.find')}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('toolsText.emoji.search')}
            placeholder={t('toolsText.emoji.search_placeholder')}
            spellCheck={false}
            className={`w-full rounded-xl border border-stone-200 bg-[#fffdf8] py-3 pl-10 pr-10 text-base text-slate-800 placeholder-slate-400 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-100 ${FOCUS_RING}`}
          />
          {query && <button type="button" aria-label={t('uiTools.common.clear')} onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t('toolsText.emoji.categories')}>
          {(['all', ...EMOJI_CATEGORIES] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={category === id}
              onClick={() => setCategory(id)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${category === id ? 'border-violet-500 bg-violet-600 text-white' : 'border-stone-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'}`}
            >
              <span aria-hidden>{id === 'all' ? '✨' : CATEGORY_ICON[id]}</span>{t(`toolsText.emoji.cat_${id}`)}
            </button>
          ))}
        </div>
      </Paper>

      <div className="grid gap-4 lg:grid-cols-4">
        <Paper className="lg:col-span-3" title={t('toolsText.emoji.grid')} actions={<span className="text-[11px] text-slate-400">{t('toolsText.emoji.count', { n: results.length })}</span>}>
          {recent.length > 0 && !debounced && (
            <div className="mb-4">
              <FieldLabel>{t('toolsText.emoji.recent')}</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {recent.map((emoji) => {
                  const entry = findEntry(emoji);
                  return entry ? <button key={emoji} type="button" onClick={() => pick(entry)} className="cursor-pointer rounded-lg bg-violet-50 px-2 py-1 text-xl hover:bg-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20">{emoji}</button> : null;
                })}
              </div>
            </div>
          )}
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">{t('toolsText.emoji.none')}</p>
          ) : (
            <div className="grid max-h-[28rem] grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1 overflow-y-auto pr-1">
              {results.map((entry) => (
                <button
                  key={`${entry.category}-${entry.emoji}`}
                  type="button"
                  title={entry.keywords}
                  aria-label={entry.keywords}
                  onClick={() => pick(entry)}
                  onMouseEnter={() => setFocused(entry)}
                  onFocus={() => setFocused(entry)}
                  className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:hover:bg-violet-500/15 ${copiedKey === entry.emoji ? 'bg-emerald-100 dark:bg-emerald-500/20' : ''}`}
                >
                  {entry.emoji}
                </button>
              ))}
            </div>
          )}
        </Paper>

        <div className="space-y-4">
          <Paper title={t('toolsText.emoji.detail')}>
            {detail ? (
              <div className="text-center">
                <p className="text-6xl leading-tight" aria-hidden>{detail.emoji}</p>
                <p className="mt-2 text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{detail.keywords.split(' ').slice(0, 2).join(' ')}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{detail.keywords}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-violet-600 dark:text-violet-300">{codePoints(detail.emoji)}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t('toolsText.emoji.click_to_copy')}</p>
              </div>
            ) : <p className="py-6 text-center text-sm text-slate-400">{t('toolsText.emoji.none')}</p>}
          </Paper>

          <Paper title={t('toolsText.emoji.tray')} actions={<SoftButton onClick={() => setTray([])} disabled={tray.length === 0}>{t('uiTools.common.clear')}</SoftButton>}>
            <p className="min-h-[3.5rem] break-all rounded-xl bg-stone-50 px-3 py-2 text-2xl leading-snug dark:bg-slate-950/40" aria-live="polite">{trayText || <span className="text-sm text-slate-400">{t('toolsText.emoji.tray_empty')}</span>}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CopyButton text={trayText} label={t('toolsText.emoji.copy_tray')} onCopied={() => record({ tray: trayText }, { count: tray.length })} />
              <SoftButton disabled={tray.length === 0} onClick={() => setTray((current) => current.slice(0, -1))}>{t('toolsText.emoji.undo')}</SoftButton>
            </div>
          </Paper>
        </div>
      </div>
    </Desk>
  );
};

export default EmojiPickerWorkbench;
