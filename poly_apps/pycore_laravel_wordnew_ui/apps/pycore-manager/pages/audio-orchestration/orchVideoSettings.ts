import type {
  OrchVideoBackgroundKind,
  OrchVideoFont,
  OrchVideoSettings,
} from '@/apps/pycore-manager/api';

/** Frame rates pycore accepts (`orch_video_presets.sanitize`). */
export const ORCH_VIDEO_FPS_CHOICES = [15, 24, 25, 30, 50, 60] as const;

export interface OrchVideoRange {
  min: number;
  max: number;
  step: number;
}

const range = (min: number, max: number, step: number): OrchVideoRange => ({ min, max, step });

/** Value ranges of the settings document, mirroring the pycore sanitize clamps. */
export const ORCH_VIDEO_RANGES = {
  opacity_upcoming: range(0.1, 1, 0.01),
  opacity_past: range(0.05, 1, 0.01),
  layout: {
    scroll_seconds: range(0.1, 3, 0.05),
    focus_y: range(0.15, 0.85, 0.01),
    column_width: range(0.4, 0.95, 0.01),
    card_gap: range(10, 200, 1),
    line_gap: range(0, 60, 1),
  },
  sentence: {
    size_en: range(18, 110, 1),
    size_zh: range(16, 100, 1),
    outline: range(0, 8, 1),
  },
  word: {
    size_en: range(18, 110, 1),
    size_zh: range(16, 90, 1),
    box_padding: range(4, 40, 1),
  },
  background: {
    dim: range(0, 0.9, 0.01),
  },
} as const;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];

/** Media kind of a managed background path by extension ('' = not a background file). */
export function orchBackgroundKindOfPath(path: string): Exclude<OrchVideoBackgroundKind, 'color'> | '' {
  const lower = path.toLowerCase();
  if (IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))) return 'image';
  if (VIDEO_EXTENSIONS.some((extension) => lower.endsWith(extension))) return 'video';
  return '';
}

export function orchBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export interface OrchFontOption {
  family: string;
  available: boolean;
}

/** Font select options: installed fonts first; `cjk` limits to Chinese-capable fonts; the current value is always present. */
export function orchFontOptions(fonts: OrchVideoFont[], cjk: boolean, current: string): OrchFontOption[] {
  const usable = fonts.filter((font) => !cjk || font.cjk);
  const options = [
    ...usable.filter((font) => font.available),
    ...usable.filter((font) => !font.available),
  ].map((font) => ({ family: font.family, available: font.available }));
  if (current && !options.some((option) => option.family === current)) options.unshift({ family: current, available: true });
  return options;
}

export const cloneOrchVideoSettings = (settings: OrchVideoSettings): OrchVideoSettings => (
  JSON.parse(JSON.stringify(settings)) as OrchVideoSettings
);

export const sameOrchVideoSettings = (a: OrchVideoSettings, b: OrchVideoSettings): boolean => (
  JSON.stringify(a) === JSON.stringify(b)
);
