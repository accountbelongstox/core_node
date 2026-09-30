/**
 * The two text looks of a video card: "Sentence captions" (outlined text
 * lines) and "Word chips" (boxed text with the Chinese meaning underneath).
 */
import React from 'react';
import type {
  OrchVideoFont,
  OrchVideoSentenceSettings,
  OrchVideoWordSettings,
} from '@/apps/pycore-manager/api';
import { OrchColorField, OrchFieldGroup, OrchFontField, OrchRangeField, OrchToggleField } from './OrchVideoFields';
import { ORCH_L } from './orchShared';
import { ORCH_VIDEO_RANGES } from './orchVideoSettings';

export const OrchSentenceGroup: React.FC<{
  value: OrchVideoSentenceSettings;
  fonts: OrchVideoFont[];
  onChange: (patch: Partial<OrchVideoSentenceSettings>) => void;
}> = ({ value, fonts, onChange }) => (
  <OrchFieldGroup title={ORCH_L.videoGroupSentence} hint={ORCH_L.videoGroupSentenceHint}>
    <OrchFontField label={ORCH_L.fieldFontEn} value={value.font_en} fonts={fonts} cjk={false} onChange={(font_en) => onChange({ font_en })} />
    <OrchFontField label={ORCH_L.fieldFontZh} value={value.font_zh} fonts={fonts} cjk onChange={(font_zh) => onChange({ font_zh })} />
    <OrchRangeField label={ORCH_L.fieldSizeEn} value={value.size_en} range={ORCH_VIDEO_RANGES.sentence.size_en} onChange={(size_en) => onChange({ size_en })} />
    <OrchRangeField label={ORCH_L.fieldSizeZh} value={value.size_zh} range={ORCH_VIDEO_RANGES.sentence.size_zh} onChange={(size_zh) => onChange({ size_zh })} />
    <OrchColorField label={ORCH_L.fieldTextColor} value={value.text} onChange={(text) => onChange({ text })} />
    <OrchColorField label={ORCH_L.fieldActiveColor} value={value.active} onChange={(active) => onChange({ active })} />
    <OrchColorField label={ORCH_L.fieldOutlineColor} value={value.outline_color} onChange={(outline_color) => onChange({ outline_color })} />
    <OrchRangeField label={ORCH_L.fieldOutline} value={value.outline} range={ORCH_VIDEO_RANGES.sentence.outline} onChange={(outline) => onChange({ outline })} />
    <OrchToggleField label={ORCH_L.fieldBold} checked={value.bold} onChange={(bold) => onChange({ bold })} />
  </OrchFieldGroup>
);

export const OrchWordGroup: React.FC<{
  value: OrchVideoWordSettings;
  fonts: OrchVideoFont[];
  onChange: (patch: Partial<OrchVideoWordSettings>) => void;
}> = ({ value, fonts, onChange }) => (
  <OrchFieldGroup title={ORCH_L.videoGroupWord} hint={ORCH_L.videoGroupWordHint}>
    <OrchFontField label={ORCH_L.fieldFontEn} value={value.font_en} fonts={fonts} cjk={false} onChange={(font_en) => onChange({ font_en })} />
    <OrchFontField label={ORCH_L.fieldFontZh} value={value.font_zh} fonts={fonts} cjk onChange={(font_zh) => onChange({ font_zh })} />
    <OrchRangeField label={ORCH_L.fieldSizeEn} value={value.size_en} range={ORCH_VIDEO_RANGES.word.size_en} onChange={(size_en) => onChange({ size_en })} />
    <OrchRangeField label={ORCH_L.fieldSizeZh} value={value.size_zh} range={ORCH_VIDEO_RANGES.word.size_zh} onChange={(size_zh) => onChange({ size_zh })} />
    <OrchColorField label={ORCH_L.fieldTextColor} value={value.text} onChange={(text) => onChange({ text })} />
    <OrchColorField label={ORCH_L.fieldActiveColor} value={value.active} onChange={(active) => onChange({ active })} />
    <OrchColorField label={ORCH_L.fieldBox} value={value.box} onChange={(box) => onChange({ box })} />
    <OrchColorField label={ORCH_L.fieldBoxActive} value={value.box_active} onChange={(box_active) => onChange({ box_active })} />
    <OrchRangeField label={ORCH_L.fieldBoxPadding} value={value.box_padding} range={ORCH_VIDEO_RANGES.word.box_padding} onChange={(box_padding) => onChange({ box_padding })} />
    <OrchColorField label={ORCH_L.fieldMeaning} value={value.meaning} onChange={(meaning) => onChange({ meaning })} />
    <OrchColorField label={ORCH_L.fieldMeaningActive} value={value.meaning_active} onChange={(meaning_active) => onChange({ meaning_active })} />
    <OrchToggleField label={ORCH_L.fieldBold} checked={value.bold} onChange={(bold) => onChange({ bold })} />
  </OrchFieldGroup>
);
