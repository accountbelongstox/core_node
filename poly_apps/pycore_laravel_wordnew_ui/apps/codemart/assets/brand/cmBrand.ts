import { CM_BRAND_DEFAULT_ID, CM_BRAND_FORMS } from './cmBrandDefault.generated';

export type CmBrandForm = keyof typeof CM_BRAND_FORMS;
export type CmBrandTone = 'light' | 'dark' | 'current';

const defaultAssets = import.meta.glob('./default/*.{svg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const TONE_SUFFIX: Record<CmBrandTone, string> = { light: '', dark: '-white', current: '-current' };

/** Brand forms: mark = small logo, lockup = large logo (mark + text), text = text only. */
export const CM_BRAND = {
  id: CM_BRAND_DEFAULT_ID,
  forms: CM_BRAND_FORMS,
  /** Inline SVG spec (viewBox + body drawn in currentColor): use through components/CmLogo.tsx. */
  inline: (form: CmBrandForm) => CM_BRAND_FORMS[form],
  /** Image URL of a form for <img>: light = black ink for light surfaces, dark = white for dark surfaces. */
  url: (form: CmBrandForm, tone: CmBrandTone = 'light'): string => defaultAssets[`./default/${form}${TONE_SUFFIX[tone]}.svg`] ?? '',
  png: (form: CmBrandForm): string => defaultAssets[`./default/${form}.png`] ?? '',
} as const;

export default CM_BRAND;
