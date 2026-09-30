/**
 * The stage look: pycore's video presets (`ui/audio_orch/video/presets`, the
 * same documents its ffmpeg renderer uses), cached on the device so the stage
 * keeps its look offline. Before the first contact the Clean White defaults
 * apply. Background media paths live on the pycore machine, so the stage uses
 * the preset colour for every background kind.
 */
import {
  pycoreApi,
  type OrchVideoPreset,
  type OrchVideoSettings,
} from '../../../../core/integrations/pycore';
import { CapJsonStore, Directory } from '../../platform/capabilities';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';

const PRESETS_PATH = 'wfnew-orch/video_presets.json';

export const ORCH_FALLBACK_PRESET_ID = 'clean_white';

/** pycore `orch_video_presets.default_settings` (Clean White) for the first offline start. */
const FALLBACK_SETTINGS: OrchVideoSettings = {
  version: 1,
  languages: 'both',
  fps: 30,
  show_progress_bar: true,
  progress_color: '#4F46E5',
  opacity_upcoming: 0.78,
  opacity_past: 0.4,
  layout: { scroll_mode: 'step', scroll_seconds: 0.55, focus_y: 0.42, column_width: 0.8, card_gap: 54, line_gap: 12 },
  sentence: {
    font_en: 'Georgia', font_zh: 'Noto Serif SC', size_en: 48, size_zh: 38, bold: true,
    text: '#1E293B', active: '#0B57D0', outline_color: '#FFFFFF', outline: 2,
  },
  word: {
    font_en: 'Inter', font_zh: 'Noto Sans SC', size_en: 44, size_zh: 32, bold: true,
    text: '#3730A3', active: '#FFFFFF', box: '#E0E7FF', box_active: '#4F46E5', box_padding: 14,
    meaning: '#64748B', meaning_active: '#4F46E5',
  },
  background: { kind: 'color', color: '#FFFFFF', path: '', dim: 0.35 },
};

export interface OrchPresetDocument {
  active: string;
  presets: OrchVideoPreset[];
  fetchedAt: number;
}

const FALLBACK_DOCUMENT: OrchPresetDocument = {
  active: ORCH_FALLBACK_PRESET_ID,
  presets: [{ id: ORCH_FALLBACK_PRESET_ID, name: 'Clean White', builtin: true, settings: FALLBACK_SETTINGS }],
  fetchedAt: 0,
};

class WordNewOrchPresetStoreService {
  private readonly file = new CapJsonStore<OrchPresetDocument>(PRESETS_PATH, FALLBACK_DOCUMENT, Directory.Data);

  /** Device copy first; refreshed from pycore when a link is up. */
  async load(): Promise<OrchPresetDocument> {
    const cached = await this.file.load();
    if (!(await wordNewPycoreLink.ensure()).selectedUrl) return cached;
    const answer = await pycoreApi.orchVideoPresets().catch(() => null);
    if (!answer?.success || !Array.isArray(answer.presets) || answer.presets.length === 0) return cached;
    const document = { active: answer.active, presets: answer.presets, fetchedAt: Date.now() };
    await this.file.save(document);
    return document;
  }

  settingsFor(document: OrchPresetDocument, presetId: string): OrchVideoSettings {
    const preset = document.presets.find((entry) => entry.id === (presetId || document.active))
      ?? document.presets.find((entry) => entry.id === document.active)
      ?? document.presets[0];
    return preset?.settings ?? FALLBACK_SETTINGS;
  }
}

export const wordNewOrchPresetStore = new WordNewOrchPresetStoreService();
