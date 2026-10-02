/**
 * WfNewStudySettingsSheet — a compact settings popover for the shelf study
 * surface, porting the legacy client's sidebar settings form. Edits the app's
 * PERSISTED learning-model + review settings (wfNewSettings: wmPlayCount /
 * wmReplayCount / wmPlayInterval / wmPlaybackSpeed / wmReplayGapWords /
 * reviewOrder) so the recite loop and review order pick the values up live, plus
 * the panel-level Compact (brief) and Auto-scroll toggles.
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewSettings, type WfNewSettings } from '../../WfNewSettingsStore';
import { studyT } from './WfNewStudyLocales';
// Shared daily-goal editor (◀ input ▶) — the goal is edited identically here
// and on the home dashboard; see ../WfNewDailyGoalEditor.
import { WfNewDailyGoalEditor } from '../WfNewDailyGoalEditor';
// The paged-loader "words per page" label lives in the CENTRAL locale files
// (translate) rather than this feature's studyT dict, so all four shell
// languages (en/zh/ja/ko) resolve it — studyT only ships en/zh.
import { translate } from '../../WfNewLocales';
// Voice options come from the Laravel audio library (wfNewApi.getTtsVoices); the
// browser Web-Speech list is only a fallback when the library returns nothing.
import { wfNewApi } from '../../api';
import { listPracticeVoices } from '../../hooks/wordNewWordAudioFallback';

interface WfNewStudySettingsSheetProps {
  lang: string;
  theme: ElementTheme;
  brief: boolean;
  setBrief: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  onClose: () => void;
}

const REVIEW_ORDERS = ['due_first', 'random', 'hardest_first'] as const;

export const WfNewStudySettingsSheet: React.FC<WfNewStudySettingsSheetProps> = ({
  lang,
  theme,
  brief,
  setBrief,
  autoScroll,
  setAutoScroll,
  onClose,
}) => {
  // Local mirror of the persisted numeric fields (seeded once from the store).
  const [playCount, setPlayCount] = useState<number>(wfNewSettings.get('wmPlayCount'));
  const [replayCount, setReplayCount] = useState<number>(wfNewSettings.get('wmReplayCount'));
  const [interval, setIntervalVal] = useState<number>(wfNewSettings.get('wmPlayInterval'));
  const [speed, setSpeed] = useState<number>(wfNewSettings.get('wmPlaybackSpeed'));
  const [gap, setGap] = useState<number>(wfNewSettings.get('wmReplayGapWords'));
  const [perPage, setPerPage] = useState<number>(wfNewSettings.get('wmPerPage'));
  const [reviewOrder, setReviewOrder] = useState<string>(wfNewSettings.get('reviewOrder'));
  // Recite voice: '' = auto. wmVoiceUri stays the persisted value; the option list
  // is loaded once on mount from the Laravel audio library, falling back to the
  // browser's Web-Speech voices only when the library returns nothing.
  const [voiceUri, setVoiceUri] = useState<string>(wfNewSettings.get('wmVoiceUri') || '');
  const [voices, setVoices] = useState<{ uri: string; label: string; lang: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    let detachBrowser: (() => void) | undefined;
    // Fallback: the browser Web-Speech voices (async — refresh on 'voiceschanged').
    const useBrowserVoices = () => {
      if (cancelled) return;
      const refresh = () => { if (!cancelled) setVoices(listPracticeVoices()); };
      refresh();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.addEventListener('voiceschanged', refresh);
        detachBrowser = () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
      }
    };
    // Prefer the Laravel audio library (the real generated word-audio voices).
    wfNewApi.getTtsVoices()
      .then((list) => {
        if (cancelled) return;
        if (Array.isArray(list) && list.length) {
          setVoices(list.map((v) => ({ uri: v.id, label: v.label, lang: v.lang })));
        } else {
          useBrowserVoices();
        }
      })
      .catch(() => useBrowserVoices());
    return () => { cancelled = true; if (detachBrowser) detachBrowser(); };
  }, []);

  const commit = <K extends keyof WfNewSettings>(key: K, value: WfNewSettings[K]) => {
    wfNewSettings.setField(key, value);
    setDirty(true); // unsaved changes until "Save to account" succeeds
  };

  // Backend sync state: the study settings are pushed into the roamed account
  // preferences (app_settings.study, MERGED server-side — see
  // AppQyV1ProfileController::updatePreferences) so the same setup follows the
  // user across devices. The status line under the button shows whether the
  // current values are known to be in sync with the backend.
  const [sync, setSync] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const saveToBackend = async () => {
    if (!wfNewApi.isAuthenticated()) {
      setSync('error'); // guests stay local-only — login to roam settings
      return;
    }
    setSync('saving');
    try {
      await wfNewApi.updatePreferences({
        app_settings: {
          study: {
            wmPlayCount: wfNewSettings.get('wmPlayCount'),
            wmReplayCount: wfNewSettings.get('wmReplayCount'),
            wmReplayGapWords: wfNewSettings.get('wmReplayGapWords'),
            wmPlayInterval: wfNewSettings.get('wmPlayInterval'),
            wmPlaybackSpeed: wfNewSettings.get('wmPlaybackSpeed'),
            wmPerPage: wfNewSettings.get('wmPerPage'),
            wmVoiceUri: wfNewSettings.get('wmVoiceUri'),
            reviewOrder: wfNewSettings.get('reviewOrder'),
            dailyGoal: wfNewSettings.get('dailyGoal'),
          },
        },
      });
      setSync('synced');
      setSyncedAt(Date.now());
      setDirty(false);
    } catch {
      setSync('error');
    }
  };

  const syncStatusText = dirty
    ? studyT(lang, 'study.settings.unsaved')
    : sync === 'synced' && syncedAt
      ? studyT(lang, 'study.settings.synced', {
          t: new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      : sync === 'error'
        ? studyT(lang, 'study.settings.syncFailed')
        : studyT(lang, 'study.settings.unsaved');

  const numberField = (
    label: string,
    value: number,
    set: (v: number) => void,
    key: keyof WfNewSettings,
    opts: { min: number; max: number; step: number },
  ) => {
    // Integer vs. decimal is derived from the step (step < 1 → decimals allowed).
    // Decimal fields keep the dot; integer fields block it too so entry stays whole.
    const isDecimal = opts.step < 1;
    const blockedKeys = isDecimal ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.'];
    const pasteOk = (text: string) =>
      isDecimal ? /^\d*\.?\d*$/.test(text) : /^\d+$/.test(text);
    return (
      <label className="flex items-center justify-between gap-3 py-2">
        <span className="text-xs text-zinc-400">{label}</span>
        <input
          type="number"
          min={opts.min}
          max={opts.max}
          step={opts.step}
          value={value}
          inputMode={isDecimal ? 'decimal' : 'numeric'}
          pattern={isDecimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
          onKeyDown={(e) => {
            if (blockedKeys.includes(e.key)) e.preventDefault();
          }}
          onPaste={(e) => {
            if (!pasteOk(e.clipboardData.getData('text'))) e.preventDefault();
          }}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            const clamped = Math.min(opts.max, Math.max(opts.min, v));
            set(clamped);
            commit(key, clamped);
          }}
          className="w-20 text-right bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
        />
      </label>
    );
  };

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs text-zinc-400">{label}</span>
      <button
        type="button"
        onClick={() => set(!value)}
        className={`w-10 h-6 rounded-full transition-colors relative ${
          value ? 'bg-indigo-500' : 'bg-white/10'
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
            value ? 'left-5' : 'left-1'
          }`}
        />
      </button>
    </label>
  );

  return (
    <div className={`p-5 rounded-3xl ${theme.cardClass} space-y-1`}>
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/5">
        <h4 className="text-sm font-bold">{studyT(lang, 'study.settings.title')}</h4>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400"
          title={studyT(lang, 'study.settings.close')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Daily goal first — the most-touched setting; the shared editor writes
          the store + roams it to the backend itself (see WfNewDailyGoalEditor). */}
      <WfNewDailyGoalEditor lang={lang} />

      {numberField(studyT(lang, 'study.settings.playCount'), playCount, setPlayCount, 'wmPlayCount', { min: 1, max: 10, step: 1 })}
      {numberField(studyT(lang, 'study.settings.replayCount'), replayCount, setReplayCount, 'wmReplayCount', { min: 0, max: 10, step: 1 })}
      {numberField(studyT(lang, 'study.settings.gap'), gap, setGap, 'wmReplayGapWords', { min: 0, max: 20, step: 1 })}
      {numberField(studyT(lang, 'study.settings.interval'), interval, setIntervalVal, 'wmPlayInterval', { min: 0, max: 30, step: 0.5 })}
      {numberField(studyT(lang, 'study.settings.speed'), speed, setSpeed, 'wmPlaybackSpeed', { min: 0.5, max: 2, step: 0.1 })}

      <label className="flex items-center justify-between gap-3 py-2">
        <span className="text-xs text-zinc-400 shrink-0">{translate(lang, 'study.settings.voice')}</span>
        <select
          value={voiceUri}
          onChange={(e) => {
            setVoiceUri(e.target.value);
            commit('wmVoiceUri', e.target.value);
          }}
          className="max-w-[11rem] truncate bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
        >
          <option value="" className="bg-slate-900">{translate(lang, 'study.settings.voiceAuto')}</option>
          {voices.map((v) => (
            <option key={v.uri} value={v.uri} className="bg-slate-900">
              {v.label}
            </option>
          ))}
        </select>
      </label>

      {numberField(translate(lang, 'study.settings.perPage'), perPage, setPerPage, 'wmPerPage', { min: 1, max: 100, step: 1 })}

      <label className="flex items-center justify-between gap-3 py-2">
        <span className="text-xs text-zinc-400">{studyT(lang, 'study.settings.reviewOrder')}</span>
        <select
          value={reviewOrder}
          onChange={(e) => {
            setReviewOrder(e.target.value);
            commit('reviewOrder', e.target.value);
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
        >
          {REVIEW_ORDERS.map((o) => (
            <option key={o} value={o} className="bg-slate-900">
              {studyT(lang, `study.settings.order.${o}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="pt-1 border-t border-white/5">
        {toggle(studyT(lang, 'study.settings.brief'), brief, setBrief)}
        {toggle(studyT(lang, 'study.settings.autoScroll'), autoScroll, setAutoScroll)}
      </div>

      {/* Save the study settings to the roamed account preferences + show
          whether the current values are in sync with the backend. */}
      <div className="pt-2 mt-1 border-t border-white/5 space-y-1.5">
        <button
          type="button"
          onClick={() => void saveToBackend()}
          disabled={sync === 'saving'}
          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold font-mono uppercase tracking-widest transition-all"
        >
          {sync === 'saving' ? studyT(lang, 'study.settings.syncing') : studyT(lang, 'study.settings.save')}
        </button>
        <p
          className={`text-center text-[10px] font-mono ${
            dirty || sync === 'error' ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {syncStatusText}
        </p>
      </div>
    </div>
  );
};
