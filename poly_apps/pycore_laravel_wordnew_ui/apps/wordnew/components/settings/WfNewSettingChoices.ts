import type { ChipOption } from '@/shared/ui/ChipGroup';
import type { SelectOption } from '@/shared/ui/SelectField';

export type Translate = (key: string, replacements?: Record<string, string | number>) => string;

export interface ChoiceDef<T extends string | number> {
  value: T;
  labelKey: string;
  hintKey?: string;
}

export const REVIEW_ORDER_VALUES = ['due_first', 'random', 'hardest_first'] as const;
export const SUBTITLE_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

export const REVIEW_ORDERS: readonly ChoiceDef<string>[] = [
  { value: 'due_first', labelKey: 'rev.orderDueFirst' },
  { value: 'random', labelKey: 'rev.orderRandom' },
  { value: 'hardest_first', labelKey: 'rev.orderHardest' },
];

export const REVIEW_ALGORITHMS: readonly ChoiceDef<string>[] = [
  { value: 'ebbinghaus', labelKey: 'set.algoEbbTitle', hintKey: 'set.algoEbbDesc' },
  { value: 'sm2', labelKey: 'set.algoSm2Title', hintKey: 'set.algoSm2Desc' },
  { value: 'leitner', labelKey: 'set.algoLeitnerTitle', hintKey: 'set.algoLeitnerDesc' },
  { value: 'rapid', labelKey: 'set.algoRapidTitle', hintKey: 'set.algoRapidDesc' },
];

export const WORD_LIST_LANGUAGES: readonly ChoiceDef<string>[] = [
  { value: 'english', labelKey: 'playset.langEnglish' },
  { value: 'chinese', labelKey: 'playset.langChinese' },
  { value: 'japanese', labelKey: 'playset.langJapanese' },
  { value: 'korean', labelKey: 'playset.langKorean' },
];

export const VOICE_ACCENTS: readonly ChoiceDef<string>[] = [
  { value: 'en-US', labelKey: 'set.accentUS' },
  { value: 'en-GB', labelKey: 'set.accentGB' },
  { value: 'en-CA', labelKey: 'set.accentCA' },
  { value: 'en-AU', labelKey: 'set.accentAU' },
];

export const BILINGUAL_RATIOS: readonly ChoiceDef<string>[] = [
  { value: '1en_1zh', labelKey: 'set.ratioOpt1' },
  { value: '2en_1zh', labelKey: 'set.ratioOpt2' },
];

export const RECITAL_ORDERS: readonly ChoiceDef<string>[] = [
  { value: 'target_first', labelKey: 'set.orderTarget' },
  { value: 'native_first', labelKey: 'set.orderNative' },
];

export function toChipOptions<T extends string | number>(defs: readonly ChoiceDef<T>[], trans: Translate): ChipOption<T>[] {
  return defs.map((def) => ({ value: def.value, label: trans(def.labelKey) }));
}

export function toSelectOptions<T extends string | number>(defs: readonly ChoiceDef<T>[], trans: Translate): SelectOption<T>[] {
  return defs.map((def) => ({ value: def.value, label: trans(def.labelKey) }));
}
