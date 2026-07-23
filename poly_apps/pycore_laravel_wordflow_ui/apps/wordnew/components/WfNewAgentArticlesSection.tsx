/**
 * Real-time Agent History articles on wordnew home.
 * Polls Laravel worker/recent only (wordnew never calls pycore directly).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Headphones, Loader2, Radio } from 'lucide-react';
import { wfNewApi, type WfNewAgentArticle } from '../api';
import { resolveAudioSync } from '../cache/WfNewAudioCache';
import type { ElementTheme } from '../WfNewTypes';

export type AgentArticleRow = WfNewAgentArticle;

interface Props {
  theme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onOpenBook: (sourceKey: string, title: string) => void;
}

const POLL_MS = 12_000;

export const WfNewAgentArticlesSection: React.FC<Props> = ({ theme, trans, onOpenBook }) => {
  const [rows, setRows] = useState<AgentArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const laravel = await wfNewApi.getRecentAgentArticles(20).catch(() => []);
      if (mounted.current) setRows(laravel);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [load]);

  const playAudio = (row: AgentArticleRow) => {
    if (!row.audio_url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(resolveAudioSync(row.audio_url) ?? row.audio_url);
    audioRef.current = audio;
    setPlayingId(row.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play();
  };

  if (!loading && rows.length === 0) return null;

  return (
    <section className={`${theme.cardClass} rounded-3xl border border-white/5 p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse" />
            {trans('home.agentArticles.title')}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">{trans('home.agentArticles.subtitle')}</p>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
      </div>

      <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {rows.map((row) => {
          const sk = row.source_key || row.article_id;
          const isPlaying = playingId === row.id;
          return (
            <li
              key={row.id}
              className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-zinc-100 truncate">{row.title}</div>
                  {row.title_cn && (
                    <div className="text-xs text-zinc-400 mt-0.5 truncate">{row.title_cn}</div>
                  )}
                  {row.reference_cn && (
                    <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">{row.reference_cn}</p>
                  )}
                  <div className="text-[10px] font-mono text-zinc-600 mt-2">
                    {row.word_count ? `${row.word_count} words · ` : ''}
                    {row.published_at ? new Date(row.published_at).toLocaleString() : ''}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  {row.audio_url && (
                    <button
                      type="button"
                      onClick={() => playAudio(row)}
                      className={`p-2 rounded-xl border transition-colors ${
                        isPlaying
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 text-zinc-400 hover:text-indigo-300'
                      }`}
                      title={trans('home.agentArticles.play')}
                    >
                      <Headphones className="w-4 h-4" />
                    </button>
                  )}
                  {sk && (
                    <button
                      type="button"
                      onClick={() => onOpenBook(sk, row.title)}
                      className="p-2 rounded-xl border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                      title={trans('home.agentArticles.read')}
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {row.article_en && (
                <p className="text-xs text-zinc-300 mt-3 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                  {row.article_en}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
