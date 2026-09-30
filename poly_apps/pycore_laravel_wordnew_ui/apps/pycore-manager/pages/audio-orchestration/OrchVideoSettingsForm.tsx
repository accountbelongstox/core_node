/** Full settings document of a video look: general, layout, sentence captions, word chips and background. */
import React from 'react';
import type { OrchVideoFont, OrchVideoSettings } from '@/apps/pycore-manager/api';
import OrchVideoBackgroundGroup from './OrchVideoBackgroundGroup';
import {
  OrchColorField,
  OrchFieldGroup,
  OrchRangeField,
  OrchSelectField,
  OrchToggleField,
} from './OrchVideoFields';
import { OrchSentenceGroup, OrchWordGroup } from './OrchVideoTextGroups';
import { ORCH_L } from './orchShared';
import { ORCH_VIDEO_FPS_CHOICES, ORCH_VIDEO_RANGES } from './orchVideoSettings';

const OrchVideoSettingsForm: React.FC<{
  settings: OrchVideoSettings;
  fonts: OrchVideoFont[];
  fontsDirectory: string | null;
  onChange: (settings: OrchVideoSettings) => void;
  onError: (message: string | null) => void;
}> = ({ settings, fonts, fontsDirectory, onChange, onError }) => {
  const { layout } = settings;
  const setLayout = (patch: Partial<OrchVideoSettings['layout']>) => onChange({ ...settings, layout: { ...layout, ...patch } });
  return (
    <div className="space-y-3">
      <OrchFieldGroup title={ORCH_L.videoGroupGeneral}>
        <OrchSelectField
          label={ORCH_L.fieldLanguages}
          value={settings.languages}
          onChange={(languages) => onChange({ ...settings, languages: languages as OrchVideoSettings['languages'] })}
          options={[
            { value: 'both', label: ORCH_L.languagesBoth },
            { value: 'en', label: ORCH_L.languagesEn },
            { value: 'zh', label: ORCH_L.languagesZh },
          ]}
        />
        <OrchSelectField
          label={ORCH_L.fieldFps}
          value={String(settings.fps)}
          onChange={(fps) => onChange({ ...settings, fps: Number(fps) })}
          options={ORCH_VIDEO_FPS_CHOICES.map((fps) => ({ value: String(fps), label: String(fps) }))}
        />
        <OrchToggleField label={ORCH_L.fieldProgressBar} checked={settings.show_progress_bar} onChange={(show_progress_bar) => onChange({ ...settings, show_progress_bar })} />
        <OrchColorField label={ORCH_L.fieldProgressColor} value={settings.progress_color} onChange={(progress_color) => onChange({ ...settings, progress_color })} />
        <OrchRangeField label={ORCH_L.fieldOpacityUpcoming} value={settings.opacity_upcoming} range={ORCH_VIDEO_RANGES.opacity_upcoming} onChange={(opacity_upcoming) => onChange({ ...settings, opacity_upcoming })} />
        <OrchRangeField label={ORCH_L.fieldOpacityPast} value={settings.opacity_past} range={ORCH_VIDEO_RANGES.opacity_past} onChange={(opacity_past) => onChange({ ...settings, opacity_past })} />
      </OrchFieldGroup>

      <OrchFieldGroup title={ORCH_L.videoGroupLayout}>
        <div className="sm:col-span-2">
          <OrchSelectField
            label={ORCH_L.fieldScrollMode}
            value={layout.scroll_mode}
            onChange={(scroll_mode) => setLayout({ scroll_mode: scroll_mode as OrchVideoSettings['layout']['scroll_mode'] })}
            options={[
              { value: 'step', label: ORCH_L.scrollStep },
              { value: 'smooth', label: ORCH_L.scrollSmooth },
            ]}
          />
        </div>
        <OrchRangeField label={ORCH_L.fieldScrollSeconds} value={layout.scroll_seconds} range={ORCH_VIDEO_RANGES.layout.scroll_seconds} onChange={(scroll_seconds) => setLayout({ scroll_seconds })} />
        <OrchRangeField label={ORCH_L.fieldFocusY} value={layout.focus_y} range={ORCH_VIDEO_RANGES.layout.focus_y} onChange={(focus_y) => setLayout({ focus_y })} />
        <OrchRangeField label={ORCH_L.fieldColumnWidth} value={layout.column_width} range={ORCH_VIDEO_RANGES.layout.column_width} onChange={(column_width) => setLayout({ column_width })} />
        <OrchRangeField label={ORCH_L.fieldCardGap} value={layout.card_gap} range={ORCH_VIDEO_RANGES.layout.card_gap} onChange={(card_gap) => setLayout({ card_gap })} />
        <OrchRangeField label={ORCH_L.fieldLineGap} value={layout.line_gap} range={ORCH_VIDEO_RANGES.layout.line_gap} onChange={(line_gap) => setLayout({ line_gap })} />
      </OrchFieldGroup>

      <OrchSentenceGroup value={settings.sentence} fonts={fonts} onChange={(patch) => onChange({ ...settings, sentence: { ...settings.sentence, ...patch } })} />
      <OrchWordGroup value={settings.word} fonts={fonts} onChange={(patch) => onChange({ ...settings, word: { ...settings.word, ...patch } })} />
      <OrchVideoBackgroundGroup
        value={settings.background}
        onChange={(patch) => onChange({ ...settings, background: { ...settings.background, ...patch } })}
        onError={onError}
      />
      {fontsDirectory && (
        <p className="text-[10px] font-mono text-slate-500 break-all">{ORCH_L.fontsDirectory}: {fontsDirectory}</p>
      )}
    </div>
  );
};

export default OrchVideoSettingsForm;
