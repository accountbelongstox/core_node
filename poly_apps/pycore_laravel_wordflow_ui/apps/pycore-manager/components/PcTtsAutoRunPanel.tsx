/**
 * PcTtsAutoRunPanel — UI switches for the pycore edge-tts AUTO-run loops.
 *
 * Extracted as a standalone component (PcSettingsPage is already >800 lines).
 * Exposes the two persisted auto-run toggles the backend now reads at startup
 * instead of a hardcoded Config default:
 *
 *   - Sentence audio (edge-tts): pycoreApi.get/setSentenceAudioAutoConfig
 *     -> /api/local/sentence-audio/{status,config} (sentence_audio_auto section)
 *   - Word audio (edge-tts fallback): pycoreApi.get/setWordTtsAutoConfig
 *     -> /api/local/word-tts/{status,config} (word_tts_auto section)
 *
 * Both persist to the pycore user_data store and toggle the heartbeat callback
 * live. Fully self-contained: local React state only, guarded against an offline
 * backend (:59000). Hardcoded copy is English (the pages carry no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Volume2, Mic, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';

interface AutoRow {
  loaded: boolean;      // status fetched at least once
  enabled: boolean;     // persisted auto_start
  saving: boolean;
}

const initialRow = (): AutoRow => ({ loaded: false, enabled: false, saving: false });

const PcTtsAutoRunPanel: React.FC = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sentence, setSentence] = useState<AutoRow>(initialRow);
  const [word, setWord] = useState<AutoRow>(initialRow);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setAvailable(null);
    try {
      const [s, w] = await Promise.all([
        pycoreApi.getSentenceAudioAutoStatus(),
        pycoreApi.getWordTtsAutoStatus(),
      ]);
      setSentence({ loaded: true, enabled: !!s?.auto_start, saving: false });
      setWord({ loaded: true, enabled: !!w?.auto_start, saving: false });
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleSentence = useCallback(async (next: boolean) => {
    setSentence((r) => ({ ...r, saving: true }));
    setNotice(null);
    try {
      const res = await pycoreApi.setSentenceAudioAutoConfig(next);
      setSentence({ loaded: true, enabled: !!res?.auto_start, saving: false });
      setNotice({ ok: true, text: `Sentence audio auto-run ${res?.auto_start ? 'enabled' : 'disabled'}.` });
    } catch (e: any) {
      setSentence((r) => ({ ...r, saving: false }));
      setNotice({ ok: false, text: e?.message || 'Failed to update sentence audio auto-run.' });
    }
  }, []);

  const toggleWord = useCallback(async (next: boolean) => {
    setWord((r) => ({ ...r, saving: true }));
    setNotice(null);
    try {
      const res = await pycoreApi.setWordTtsAutoConfig(next);
      setWord({ loaded: true, enabled: !!res?.auto_start, saving: false });
      setNotice({ ok: true, text: `Word audio auto-run ${res?.auto_start ? 'enabled' : 'disabled'}.` });
    } catch (e: any) {
      setWord((r) => ({ ...r, saving: false }));
      setNotice({ ok: false, text: e?.message || 'Failed to update word audio auto-run.' });
    }
  }, []);

  const renderRow = (
    row: AutoRow,
    Icon: React.ComponentType<{ className?: string }>,
    title: string,
    desc: string,
    onToggle: (next: boolean) => void,
  ) => (
    <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${available === true ? '' : 'opacity-50'}`}>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-indigo-400" /> {title}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <button
        onClick={() => onToggle(!row.enabled)}
        disabled={available !== true || row.saving}
        role="switch"
        aria-checked={row.enabled}
        className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-50 ${row.enabled ? 'bg-emerald-500' : 'bg-slate-400/50 dark:bg-white/15'}`}
        title={row.enabled ? 'Auto-run ON — click to disable' : 'Auto-run OFF — click to enable'}
      >
        {row.saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        ) : (
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${row.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        )}
      </button>
    </div>
  );

  return (
    <section className="pc-glass p-6 space-y-3">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div>
          <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Auto-run (edge-tts)</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Whether pycore continuously claims + synthesizes missing audio from Laravel. Persisted; not a backend hardcode.
          </p>
        </div>
        <button onClick={() => void load()} disabled={available === null}
          className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50" title="Reload auto-run status">
          <RefreshCw className={`w-3.5 h-3.5 ${available === null ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {available === false && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            Auto-run status unavailable — the pycore backend (:59000) may be offline.
          </span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {renderRow(sentence, Volume2, 'Auto-generate sentence audio',
          'Runs the edge-tts sentence-library worker on boot. Off = generate on demand only.', toggleSentence)}
        {renderRow(word, Mic, 'Auto-generate word audio',
          'Runs the edge-tts word fallback poller. Off = Puter.js / batch bar is the word-audio source.', toggleWord)}
      </div>

      {notice && (
        <span className={`text-[11px] ${notice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{notice.text}</span>
      )}
    </section>
  );
};

export default PcTtsAutoRunPanel;
