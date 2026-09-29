/**
 * Audio-orchestration video look (`ui/audio_orch/video/*`): the preset store,
 * the live preview frame and the managed background import. The settings
 * document mirrors pycore `orch_video_presets.sanitize`.
 */
import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';

export type OrchVideoLanguages = 'both' | 'en' | 'zh';
export type OrchVideoScrollMode = 'step' | 'smooth';
export type OrchVideoBackgroundKind = 'color' | 'image' | 'video';

export interface OrchVideoLayoutSettings {
  scroll_mode: OrchVideoScrollMode;
  scroll_seconds: number;
  focus_y: number;
  column_width: number;
  card_gap: number;
  line_gap: number;
}

export interface OrchVideoSentenceSettings {
  font_en: string;
  font_zh: string;
  size_en: number;
  size_zh: number;
  bold: boolean;
  text: string;
  active: string;
  outline_color: string;
  outline: number;
}

export interface OrchVideoWordSettings {
  font_en: string;
  font_zh: string;
  size_en: number;
  size_zh: number;
  bold: boolean;
  text: string;
  active: string;
  box: string;
  box_active: string;
  box_padding: number;
  meaning: string;
  meaning_active: string;
}

export interface OrchVideoBackgroundSettings {
  kind: OrchVideoBackgroundKind;
  color: string;
  /** Only ever a path returned by the background import route. */
  path: string;
  dim: number;
}

export interface OrchVideoSettings {
  version?: number;
  languages: OrchVideoLanguages;
  fps: number;
  show_progress_bar: boolean;
  progress_color: string;
  opacity_upcoming: number;
  opacity_past: number;
  layout: OrchVideoLayoutSettings;
  sentence: OrchVideoSentenceSettings;
  word: OrchVideoWordSettings;
  background: OrchVideoBackgroundSettings;
}

export interface OrchVideoPreset {
  id: string;
  name: string;
  builtin: boolean;
  settings: OrchVideoSettings;
}

export interface OrchVideoFont {
  family: string;
  cjk: boolean;
  serif: boolean;
  available: boolean;
}

export interface OrchVideoPresetsResponse {
  success: boolean;
  error?: string;
  active: string;
  presets: OrchVideoPreset[];
  default_settings: OrchVideoSettings;
  fonts: OrchVideoFont[];
  fonts_directory: string | null;
}

/** Save answers with the full list plus the id of the saved / created preset. */
export interface OrchVideoPresetSaveResponse extends OrchVideoPresetsResponse {
  preset_id?: string;
}

export interface OrchVideoPreviewResponse {
  success: boolean;
  error?: string;
  /** PNG data URL (1280x720). */
  image?: string;
  width?: number;
  height?: number;
}

export interface OrchVideoBackgroundImportResponse {
  success: boolean;
  error?: string;
  path?: string;
  kind?: Exclude<OrchVideoBackgroundKind, 'color'>;
  name?: string;
}

const PREVIEW_TIMEOUT_MS = 60_000;

export const pycoreApiOrchestrationVideo = {
  orchVideoPresets: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoPresets, {}) as Promise<OrchVideoPresetsResponse>,
  orchVideoPresetSave: (presetId: string, name: string, settings: OrchVideoSettings, activate = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoPresetSave, {
      preset_id: presetId, name, settings, activate,
    }) as Promise<OrchVideoPresetSaveResponse>,
  orchVideoPresetDelete: (presetId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoPresetDelete, { preset_id: presetId }) as Promise<OrchVideoPresetsResponse>,
  orchVideoPresetActivate: (presetId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoPresetActivate, { preset_id: presetId }) as Promise<OrchVideoPresetsResponse>,
  orchVideoPreview: (settings: OrchVideoSettings) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoPreview, { settings }, PREVIEW_TIMEOUT_MS) as Promise<OrchVideoPreviewResponse>,
  orchVideoBackgroundImport: (path: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchVideoBackgroundImport, { path }, 60_000) as Promise<OrchVideoBackgroundImportResponse>,
};
