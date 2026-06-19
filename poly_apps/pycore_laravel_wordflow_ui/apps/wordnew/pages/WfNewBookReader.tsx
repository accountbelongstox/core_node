/**
 * WfNewBookReader — book -> chapter -> verses reading surface (Books v3.1).
 *
 * Opened from the home Books rail (a content card with a `sourceKey`). Loads the
 * book's chapter list (GET /media/books/{key}/chapters), lets the reader pick a
 * chapter, and shows that chapter's verses bilingually (every checked language
 * stacked per verse, blank where a language is 留空). A legacy/unstructured book
 * (chapter_count 0) falls back to a flat verse read with no chapter rail.
 *
 * All data flows through the single wfNewApi gateway (mock ⇄ real), so this page
 * is identical offline and against the live backend.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, Layers, Volume2, Loader2 } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import {
  wfNewApi,
  type WfNewBookChapter,
  type WfNewBookVerse,
} from '../api';

interface WfNewBookReaderProps {
  sourceKey: string;
  title: string;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  onBack: () => void;
}

/** Order the per-verse languages with the primary/native language first. */
function orderedLangs(verse: WfNewBookVerse, languages: string[]): string[] {
  const keys = verse.languages ? Object.keys(verse.languages) : [];
  const base = keys.length ? keys : languages;
  const primary = verse.language && base.includes(verse.language) ? verse.language : base[0];
  return [primary, ...base.filter((l) => l !== primary)].filter(Boolean) as string[];
}

export const WfNewBookReader: React.FC<WfNewBookReaderProps> = ({
  sourceKey,
  title,
  trans,
  addToast,
  onBack,
}) => {
  const [languages, setLanguages] = useState<string[]>([]);
  const [chapters, setChapters] = useState<WfNewBookChapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<WfNewBookVerse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [flat, setFlat] = useState(false); // legacy/unstructured book: read without chapters

  // Load the verses for one chapter (or the whole book when flat / chapterIndex null).
  const loadVerses = useCallback(
    async (chapterIndex: number | null) => {
      setLoadingVerses(true);
      try {
        const page = await wfNewApi.getBookVerses(sourceKey, {
          chapterIndex: chapterIndex ?? undefined,
          perPage: chapterIndex === null ? 300 : 500,
        });
        setVerses(page.items);
      } catch (e) {
        console.warn('[wordnew] Failed to load verses.', e);
        addToast(trans('content.loadFailed'), 'warning');
        setVerses([]);
      } finally {
        setLoadingVerses(false);
      }
    },
    [sourceKey, addToast, trans],
  );

  // On book change: load the chapter list, then auto-open chapter 1 (or flat read).
  useEffect(() => {
    let cancelled = false;
    setLoadingChapters(true);
    setChapters([]);
    setVerses([]);
    setActiveChapter(null);
    setFlat(false);

    wfNewApi
      .getBookChapters(sourceKey)
      .then((res) => {
        if (cancelled) return;
        setLanguages(res.languages || []);
        setChapters(res.chapters || []);
        if ((res.chapterCount || 0) > 0 && res.chapters.length) {
          const first = res.chapters[0].chapterIndex;
          setActiveChapter(first);
          void loadVerses(first);
        } else {
          // Legacy/unstructured book: no chapter rows -> flat read.
          setFlat(true);
          void loadVerses(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn('[wordnew] Failed to load chapters.', e);
        setFlat(true);
        void loadVerses(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingChapters(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceKey, loadVerses]);

  const selectChapter = (chapterIndex: number) => {
    setActiveChapter(chapterIndex);
    void loadVerses(chapterIndex);
  };

  const speak = (text: string | null, lang: string | null) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (lang) u.lang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : lang;
      window.speechSynthesis.speak(u);
    } catch {
      /* best-effort TTS */
    }
  };

  const chapterTitle = (c: WfNewBookChapter): string => {
    const t = c.titles?.en || Object.values(c.titles || {}).find((v) => !!v);
    return (t as string) || `Chapter ${c.chapterIndex + 1}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 cursor-pointer shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight truncate flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
              {title}
            </h2>
            <p className="text-zinc-500 text-xs font-mono">
              {flat
                ? trans('reader.flat')
                : trans('reader.chapterCount', { count: chapters.length })}
            </p>
          </div>
        </div>
        {languages.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono">
            {languages.map((l) => (
              <span key={l} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 uppercase">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chapter rail */}
      {!flat && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
          {loadingChapters && chapters.length === 0 ? (
            <span className="text-xs text-zinc-500 font-mono">{trans('reader.loadingChapters')}</span>
          ) : (
            chapters.map((c) => (
              <button
                key={c.chapterIndex}
                onClick={() => selectChapter(c.chapterIndex)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  activeChapter === c.chapterIndex
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title={`${chapterTitle(c)} · ${c.sentenceCount}`}
              >
                {chapterTitle(c)}
              </button>
            ))
          )}
        </div>
      )}

      {/* Verses */}
      <div className="space-y-3">
        {loadingVerses ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-mono">{trans('reader.loadingVerses')}</span>
          </div>
        ) : verses.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            {trans('reader.empty')}
          </div>
        ) : (
          verses.map((v, idx) => {
            const langs = orderedLangs(v, languages);
            return (
              <div
                key={`${v.grain}-${v.seq}`}
                className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 flex gap-3"
              >
                <span className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {langs.map((lang, li) => {
                    const cell = v.languages?.[lang];
                    const text = cell ? cell.text : li === 0 ? v.text : null;
                    return (
                      <div key={lang} className="flex items-start gap-2 group">
                        <span className="shrink-0 mt-1 text-[9px] font-mono uppercase text-zinc-600 w-6">{lang}</span>
                        <p
                          className={
                            li === 0
                              ? 'text-zinc-100 leading-relaxed'
                              : 'text-zinc-400 text-sm leading-relaxed'
                          }
                        >
                          {text || <span className="text-zinc-700 italic">—</span>}
                        </p>
                        {text && (
                          <button
                            onClick={() => speak(text, lang)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-amber-300 cursor-pointer"
                            aria-label="Speak"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
