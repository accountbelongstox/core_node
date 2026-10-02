/**
 * WfNewStudySettingsSheet — a compact settings popover for the shelf study
 * surface, porting the legacy client's sidebar settings form. Edits the app's
 * PERSISTED learning-model + review settings (wfNewSettings: wmPlayCount /
 * wmReplayCount / wmPlayInterval / wmPlaybackSpeed / wmReplayGapWords /
 * reviewOrder) so the recite loop and review order pick the values up live, plus
 * the panel-level Compact (brief) and Auto-scroll toggles.
 */
import React, { useEffect, useState } from 'react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewSettings, type WfNewSettingKeyOf } from '../../WfNewSettingsStore';
import { useWfNewSetting } from '../../useWfNewSettings';
import { ModalHeader } from '@/shared/ui/ModalParts';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SelectField } from '@/shared/ui/SelectField';
import { SettingRow } from '@/shared/ui/SettingRow';
import { Switch } from '@/shared/ui/Switch';
import { REVIEW_ORDER_VALUES } from '../settings/WfNewSettingChoices';
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

type NumberSettingKey = WfNewSettingKeyOf<number>;

interface NumberRowProps {
  label: string;
  settingKey: NumberSettingKey;
  min: number;
  max: number;
  step: number;
  onEdited: () => void;
}

/** Typed number row bound to one persisted numeric setting. */
const NumberRow: React.FC<NumberRowProps> = ({ label, settingKey, min, max, step, onEdited }) => {
  const [value, setValue] = useWfNewSetting(settingKey);
  return (
    <SettingRow label={label} className="py-2">
      <NumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => { setValue(next); onEdited(); }}
      />
    </SettingRow>
  );
};

const NUMBER_ROWS: ReadonlyArray<{ labelKey: string; key: NumberSettingKey; min: number; max: number; step: number }> = [
  { labelKey: 'study.settings.playCount', key: 'wmPlayCount', min: 1, max: 10, step: 1 },
  { labelKey: 'study.settings.replayCount', key: 'wmReplayCount', min: 0, max: 10, step: 1 },
  { labelKey: 'study.settings.gap', key: 'wmReplayGapWords', min: 0, max: 20, step: 1 },
  { labelKey: 'study.settings.interval', key: 'wmPlayInterval', min: 0, max: 30, step: 0.5 },
  { labelKey: 'study.settings.speed', key: 'wmPlaybackSpeed', min: 0.5, max: 2, step: 0.1 },
];

const SYNCED_STUDY_KEYS = [
  'wmPlayCount', 'wmReplayCount', 'wmReplayGapWords', 'wmPlayInterval', 'wmPlaybackSpeed', 'wmPerPage', 'wmVoiceUri', 'reviewOrder', 'dailyGoal',
] as const;

export const WfNewStudySettingsSheet: React.FC<WfNewStudySettingsSheetProps> = ({
  lang,
  theme,
  brief,
  setBrief,
  autoScroll,
  setAutoScroll,
  onClose,
}) => {
  // Recite voice: '' = auto. wmVoiceUri stays the persisted value; the option list
  // is loaded once on mount from the Laravel audio library, falling back to the
  // browser's Web-Speech voices only when the library returns nothing.
  const [voiceUri, setVoiceUri] = useWfNewSetting('wmVoiceUri');
  const [reviewOrder, setReviewOrder] = useWfNewSetting('reviewOrder');
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

  // Backend sync state: the study settings are pushed into the roamed account
  // preferences (app_settings.study, MERGED server-side — see
  // AppQyV1ProfileController::updatePreferences) so the same setup follows the
  // user across devices. The status line under the button shows whether the
  // current values are known to be in sync with the backend.
  const [sync, setSync] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const markDirty = () => setDirty(true); // unsaved changes until "Save to account" succeeds

  const saveToBackend = async () => {
    if (!wfNewApi.isAuthenticated()) {
      setSync('error'); // guests stay local-only — login to roam settings
      return;
    }
    setSync('saving');
    try {
      await wfNewApi.updatePreferences({
        app_settings: {
          study: Object.fromEntries(SYNCED_STUDY_KEYS.map((key) => [key, wfNewSettings.get(key)])),
        },
      });
      setSync('synced');
      setSyncedAt(Date.now());
      setDirty(false);
    } catch {
      setSync('error');
    }
  };

  const voiceOptions = [
    { value: '', label: translate(lang, 'study.settings.voiceAuto') },
    ...voices.map((voice) => ({ value: voice.uri, label: voice.label })),
  ];
  const reviewOrderOptions = REVIEW_ORDER_VALUES.map((order) => ({ value: order as string, label: studyT(lang, `study.settings.order.${order}`) }));

  const syncStatusText = dirty
    ? studyT(lang, 'study.settings.unsaved')
    : sync === 'synced' && syncedAt
      ? studyT(lang, 'study.settings.synced', {
          t: new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      : sync === 'error'
        ? studyT(lang, 'study.settings.syncFailed')
        : studyT(lang, 'study.settings.unsaved');

  return (
    <div className={`p-5 rounded-3xl ${theme.cardClass} space-y-1`}>
      <ModalHeader
        title={studyT(lang, 'study.settings.title')}
        onClose={onClose}
        closeLabel={studyT(lang, 'study.settings.close')}
        className="pb-2 mb-1 border-b border-white/5"
      />

      {/* Daily goal first — the most-touched setting; the shared editor writes
          the store + roams it to the backend itself (see WfNewDailyGoalEditor). */}
      <WfNewDailyGoalEditor lang={lang} />

      {NUMBER_ROWS.map((row) => (
        <NumberRow key={row.key} label={studyT(lang, row.labelKey)} settingKey={row.key} min={row.min} max={row.max} step={row.step} onEdited={markDirty} />
      ))}

      <SelectField
        variant="compact"
        label={translate(lang, 'study.settings.voice')}
        value={voiceUri || ''}
        options={voiceOptions}
        onChange={(next) => { setVoiceUri(next); markDirty(); }}
      />

      <NumberRow label={translate(lang, 'study.settings.perPage')} settingKey="wmPerPage" min={1} max={100} step={1} onEdited={markDirty} />

      <SelectField
        variant="compact"
        label={studyT(lang, 'study.settings.reviewOrder')}
        value={reviewOrder}
        options={reviewOrderOptions}
        onChange={(next) => { setReviewOrder(next); markDirty(); }}
      />

      <div className="pt-1 border-t border-white/5">
        <SettingRow label={studyT(lang, 'study.settings.brief')} className="py-2"><Switch on={brief} onChange={setBrief} /></SettingRow>
        <SettingRow label={studyT(lang, 'study.settings.autoScroll')} className="py-2"><Switch on={autoScroll} onChange={setAutoScroll} /></SettingRow>
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
