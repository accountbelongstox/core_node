/** Learning Words: the signed-in learner's word cards as a flip-card grid or a focused one-card trainer. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Grid3x3, Shuffle, Sparkles, Volume2 } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, EmptyBlock, IconBtn, Notice, OpsPage, OpsStatusBar, Panel, Seg } from './opsKit';
import { useRemote } from './opsHooks';
import { pickTranslation, speechLocale } from './opsLogic';
import type { LearningCard, LearningWordsData } from './opsTypes';

type ViewMode = 'grid' | 'focus';

const LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'ru', 'zh'];
const LIMITS = [12, 24, 50, 100];
const ALL = '';

const shuffled = <T,>(items: readonly T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

const LearningWordsWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, lastRun }) => {
  const { t, i18n } = useTranslation();
  const previous = lastRun?.input as { lang_code?: string } | null | undefined;
  const [langCode, setLangCode] = useState(previous?.lang_code ?? 'en');
  const [limit, setLimit] = useState(24);
  const [mode, setMode] = useState<ViewMode>('grid');
  const [status, setStatus] = useState(ALL);
  const [order, setOrder] = useState<number[] | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [position, setPosition] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cards = useRemote(() => callToolApi<LearningWordsData>(tool.apiMethod, { lang_code: langCode, limit }), [langCode, limit]);
  const preferred = [i18n.language.split('-')[0], 'zh', 'en'];

  useEffect(() => { setOrder(null); setRevealed(new Set()); setPosition(0); }, [cards.data]);

  const all = cards.data?.words ?? [];
  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((card) => counts.set(card.learning_status ?? '-', (counts.get(card.learning_status ?? '-') ?? 0) + 1));
    return Array.from(counts.entries());
  }, [all]);
  const filtered = useMemo(() => all.filter((card) => !status || (card.learning_status ?? '-') === status), [all, status]);
  const visible = useMemo(() => (order ? order.map((index) => filtered[index]).filter(Boolean) : filtered), [order, filtered]);
  const current = visible[Math.min(position, Math.max(0, visible.length - 1))];

  const translationOf = (card: LearningCard): string => pickTranslation(card.native_translation ?? card.translations, preferred);
  const toggle = (id: number): void => setRevealed((set) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const pronounce = (card: LearningCard): void => {
    const url = card.tts_files?.find((file) => file.url)?.url;
    if (url && audioRef.current) {
      audioRef.current.src = laravelMediaUrl(url);
      void audioRef.current.play().catch(() => undefined);
    } else if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(card.word);
      utterance.lang = speechLocale(langCode);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const go = (delta: number): void => setPosition((value) => Math.min(visible.length - 1, Math.max(0, value + delta)));
  const shuffle = (): void => { setOrder(shuffled(filtered.map((_, index) => index))); setPosition(0); };
  const statLine = (card: LearningCard): React.ReactNode => (
    <div className="flex flex-wrap items-center gap-1.5">
      {card.learning_status && <Pill tone="rose" tint>{card.learning_status}</Pill>}
      <Pill stat>{t('toolsOps.learning.reviews', { count: card.review_count ?? 0 })}</Pill>
      <Pill stat tone="emerald">{card.correct_count ?? 0}</Pill>
      <Pill stat tone="rose">{card.wrong_count ?? 0}</Pill>
    </div>
  );

  return (
    <OpsPage>
      <OpsStatusBar accent="rose" mode="server" updatedAt={cards.updatedAt} loading={cards.loading} onRefresh={() => void cards.reload()}>
        {t('toolsOps.learning.status', { count: all.length, lang: langCode })}
      </OpsStatusBar>

      <div className="flex flex-wrap items-center gap-3">
        <Chips accent="rose" value={langCode} onChange={setLangCode} options={LANGUAGES.map((code) => ({ value: code, label: t(`uiTools.languages.${code}`, { defaultValue: code }) }))} nowrap className="max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Seg accent="rose" value={mode} onChange={setMode} options={[{ value: 'grid', label: t('toolsOps.learning.mode_grid'), icon: Grid3x3 }, { value: 'focus', label: t('toolsOps.learning.mode_focus'), icon: Sparkles }]} />
        <Seg accent="rose" value={limit} onChange={setLimit} options={LIMITS.map((value) => ({ value, label: String(value) }))} />
        <Btn size="sm" icon={Shuffle} onClick={shuffle} disabled={filtered.length < 2}>{t('toolsOps.learning.shuffle')}</Btn>
      </div>
      {statuses.length > 1 && (
        <Chips accent="rose" value={status} onChange={(value) => { setStatus(value); setOrder(null); setPosition(0); }} options={[{ value: ALL, label: `${t('toolsOps.library.all')} (${all.length})` }, ...statuses.map(([value, count]) => ({ value: value === '-' ? '-' : value, label: `${value} (${count})` }))]} />
      )}

      {cards.error && <Notice tone="error">{cards.error}</Notice>}
      <audio ref={audioRef} className="hidden" />

      {visible.length === 0 && !cards.loading && !cards.error ? (
        <EmptyBlock icon={Sparkles}>{t('toolsOps.learning.empty')}</EmptyBlock>
      ) : mode === 'grid' ? (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${cards.loading ? 'opacity-60' : ''}`}>
          {visible.map((card) => {
            const open = revealed.has(card.id);
            return (
              <div key={card.id} className="flex min-h-[9rem] flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
                <button type="button" onClick={() => toggle(card.id)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                  <span className="block truncate text-lg font-semibold text-slate-900 dark:text-white">{card.word}</span>
                  <span className="block truncate font-mono text-[11px] text-slate-400">{(card.us_phonetic || card.phonetic || card.uk_phonetic) ? `/${card.us_phonetic || card.phonetic || card.uk_phonetic}/` : ''}</span>
                  <span className={`mt-2 block text-sm ${open ? 'text-rose-600 dark:text-rose-300' : 'text-slate-300 dark:text-slate-600'}`}>{open ? (translationOf(card) || t('toolsOps.library.no_translation')) : t('toolsOps.learning.tap_to_reveal')}</span>
                </button>
                <div className="flex items-center justify-between gap-2">
                  {statLine(card)}
                  <IconBtn icon={Volume2} title={t('toolsOps.learning.pronounce')} accent="rose" onClick={() => pronounce(card)} />
                </div>
              </div>
            );
          })}
        </div>
      ) : current ? (
        <Panel accent="rose" bodyClassName="p-5 sm:p-8">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
            <ProgressBar done={position + 1} total={visible.length} tone="rose" className="h-1.5 w-full" label={t('toolsOps.learning.progress')} />
            <p className="text-[11px] tabular-nums text-slate-400">{position + 1} / {visible.length}</p>
            <p className="break-words text-4xl font-bold text-slate-900 dark:text-white">{current.word}</p>
            <p className="font-mono text-sm text-slate-400">{(current.us_phonetic || current.phonetic || current.uk_phonetic) ? `/${current.us_phonetic || current.phonetic || current.uk_phonetic}/` : ''}</p>
            <div className="min-h-[3rem] text-xl text-rose-600 dark:text-rose-300">{revealed.has(current.id) ? (translationOf(current) || t('toolsOps.library.no_translation')) : ''}</div>
            {statLine(current)}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Btn icon={ChevronLeft} onClick={() => go(-1)} disabled={position === 0}>{t('toolsOps.common.prev')}</Btn>
              <Btn variant="soft" accent="rose" icon={revealed.has(current.id) ? EyeOff : Eye} onClick={() => toggle(current.id)}>{revealed.has(current.id) ? t('toolsOps.learning.hide') : t('toolsOps.learning.reveal')}</Btn>
              <Btn variant="soft" accent="rose" icon={Volume2} onClick={() => pronounce(current)}>{t('toolsOps.learning.pronounce')}</Btn>
              <Btn onClick={() => go(1)} disabled={position >= visible.length - 1}>{t('toolsOps.common.next')}<ChevronRight className="h-4 w-4" /></Btn>
            </div>
          </div>
        </Panel>
      ) : null}
    </OpsPage>
  );
};

export default LearningWordsWorkbench;
