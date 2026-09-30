/**
 * Theme-aware form classes of the orchestration UI: controls take the active
 * theme's input colours (a closed select always shows its value on light and
 * dark themes), labels the theme's secondary text; number inputs are compact.
 */
import type { ElementTheme } from '../../WfNewThemes';

export interface OrchFormStyles {
  field: string;
  select: string;
  number: string;
  label: string;
  hint: string;
  heading: string;
  chip: string;
  chipActive: string;
  iconButton: string;
}

export function orchFormStyles(theme: ElementTheme): OrchFormStyles {
  const control = `${theme.inputClass} rounded-xl px-3 py-2 text-xs outline-none transition-colors disabled:opacity-50`;
  return {
    field: `${control} w-full`,
    select: `${control} w-full min-w-0 cursor-pointer appearance-auto`,
    number: `${control} w-16 shrink-0 text-center tabular-nums`,
    label: `block space-y-1 text-[11px] font-bold ${theme.textSecondaryClass}`,
    hint: `text-[11px] ${theme.textSecondaryClass}`,
    heading: `text-xs font-bold ${theme.textPrimaryClass}`,
    chip: `rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${theme.borderClass} ${theme.textSecondaryClass} hover:opacity-80`,
    chipActive: `rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${theme.accentBg}`,
    iconButton: `rounded-lg p-1.5 transition-colors ${theme.textSecondaryClass} hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30`,
  };
}
