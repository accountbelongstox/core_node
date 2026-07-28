/**
 * PcDictionaryPanel — offline word lookup (ECDICT + WordNet).
 *
 * pycore serves a FREE, offline word dictionary alongside Google/AI translation.
 * This panel uses the dictionary status/lookup RPC v2 routes: it shows whether the
 * data is installed (entry count) with an install hint when absent, and renders a
 * rich entry for a looked-up word — Chinese translation, IPA, English definition,
 * exam tags, frequency, Collins/Oxford ratings, word forms and WordNet synonyms.
 *
 * Self-contained inline labels (matching PcTranslatePage's `L` style — this page
 * family uses literal label objects, not the i18n `t` system).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, Search, Loader2, AlertTriangle, Star, Sparkles, Volume2,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { DictionaryStatus, DictionaryEntry } from '../../../core/api-libs/pycore';

const D = {
  title: 'Offline Dictionary',                                          // 离线词典
  subtitle: 'Free, offline ECDICT (EN↔ZH) + WordNet lookup — served alongside Google/AI translation.',
  placeholder: 'Enter an English word…',                                // 输入英文单词…
  lookup: 'Look up',                                                    // 查询
  looking: 'Looking…',                                                  // 查询中…
  installed: 'installed',                                               // 已安装
  notInstalledBadge: 'not installed',                                   // 未安装
  entries: 'entries',                                                   // 词条
  notInstalled:
    'ECDICT data is not installed. Run scripts/shells/linux/debian/install_shells/107_install_dictionaries.sh ' +
    '(or pyservice prepare.sh) to download the offline dictionary.',    // 未安装 ECDICT 数据，请运行安装脚本
  notFound: 'No ECDICT entry for this word.',                           // 词库中没有该单词
  translation: 'Translation',                                          // 中文释义
  definition: 'Definition',                                            // 英文释义
  exam: 'Exam tags',                                                    // 考试标签
  frequency: 'Frequency',                                              // 词频
  collins: 'Collins',                                                  // 柯林斯星级
  oxford: 'Oxford 3000',                                               // 牛津 3000
  synonyms: 'Synonyms (WordNet)',                                      // 同义词（WordNet）
  wordForms: 'Word forms',                                             // 词形变化
  failed: 'Lookup failed',                                             // 查询失败
};

const TAG_STYLE = 'bg-indigo-500/15 text-indigo-500';
const SYN_STYLE = 'bg-emerald-500/15 text-emerald-500';

export default function PcDictionaryPanel() {
  const [status, setStatus] = useState<DictionaryStatus | null>(null);
  const [word, setWord] = useState('');
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    pycoreApi.getDictionaryStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const lookup = useCallback(async () => {
    const w = word.trim();
    if (!w || busy) return;
    setBusy(true);
    setErr(null);
    setEntry(null);
    try {
      const e = await pycoreApi.getDictionaryLookup(w, 'zh');
      setEntry(e);
    } catch (e: any) {
      setErr(e?.message || D.failed);
    } finally {
      setBusy(false);
    }
  }, [word, busy]);

  const ecdictOn = !!status?.ecdict?.available;
  const entryCount = status?.ecdict?.entries ?? 0;

  return (
    <section className="pc-glass p-6 space-y-4">
      {/* header + availability */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <BookOpen className="w-5 h-5 text-indigo-500" /> {D.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{D.subtitle}</p>
        </div>
        {status && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            ecdictOn ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
            {ecdictOn
              ? `ECDICT ${D.installed} · ${entryCount.toLocaleString()} ${D.entries}`
              : `ECDICT ${D.notInstalledBadge}`}
          </span>
        )}
      </div>

      {/* search row */}
      <div className="flex items-center gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void lookup(); }}
          placeholder={D.placeholder}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
        />
        <button
          onClick={() => void lookup()}
          disabled={busy || !word.trim()}
          className="px-3 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition flex items-center gap-1 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {busy ? D.looking : D.lookup}
        </button>
      </div>

      {/* install hint */}
      {status && !ecdictOn && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{D.notInstalled}</span>
        </div>
      )}

      {/* error */}
      {err && (
        <div className="text-xs text-rose-500 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {D.failed}: {err}
        </div>
      )}

      {/* result */}
      {entry && (
        <div className="rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{entry.word}</span>
            {entry.phonetic && (
              <span className="inline-flex items-center gap-1 text-sm font-mono text-slate-500">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" /> /{entry.phonetic}/
              </span>
            )}
            {entry.oxford && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-sky-500/15 text-sky-500">
                {D.oxford}
              </span>
            )}
            {entry.collins > 0 && (
              <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${D.collins} ${entry.collins}`}>
                {Array.from({ length: Math.min(5, entry.collins) }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                ))}
              </span>
            )}
          </div>

          {!entry.found && (
            <p className="text-xs text-slate-400">{D.notFound}</p>
          )}

          {(entry.target_translation || entry.translation) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{D.translation}</div>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {entry.target_translation || entry.translation}
              </p>
            </div>
          )}

          {(entry.definition || entry.wordnet_definition) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{D.definition}</div>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {entry.definition || entry.wordnet_definition}
              </p>
            </div>
          )}

          {entry.tags?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{D.exam}</span>
              {entry.tags.map((tag) => (
                <span key={tag} className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${TAG_STYLE}`}>{tag}</span>
              ))}
            </div>
          )}

          {(entry.frq > 0 || entry.bnc > 0) && (
            <div className="text-[11px] font-mono text-slate-500">
              {D.frequency}: {entry.frq > 0 ? `COCA #${entry.frq.toLocaleString()}` : ''}
              {entry.frq > 0 && entry.bnc > 0 ? ' · ' : ''}
              {entry.bnc > 0 ? `BNC #${entry.bnc.toLocaleString()}` : ''}
            </div>
          )}

          {entry.exchange && (
            <div className="text-[11px] text-slate-500">
              <span className="font-bold uppercase tracking-wide text-slate-400">{D.wordForms}: </span>
              <span className="font-mono">{entry.exchange}</span>
            </div>
          )}

          {entry.synonyms?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Sparkles className="w-3 h-3 text-emerald-500" /> {D.synonyms}
              </span>
              {entry.synonyms.map((syn) => (
                <span key={syn} className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${SYN_STYLE}`}>{syn}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
