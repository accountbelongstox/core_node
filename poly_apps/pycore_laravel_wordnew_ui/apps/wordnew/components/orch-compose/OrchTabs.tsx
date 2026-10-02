import React from 'react';
import { ChipGroup, type ChipOption } from '@/shared/ui/ChipGroup';
import type { ElementTheme } from '../../WfNewThemes';

type OrchTabShape = 'sm' | 'md' | 'pill' | 'mono' | 'compact';

interface Props<T extends string | number> {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
  theme: ElementTheme;
  /** `tab`: tablist (default); `radio`: single-choice radiogroup. */
  role?: 'tab' | 'radio';
  shape?: OrchTabShape;
  label?: string;
  nowrap?: boolean;
  className?: string;
}

const SHAPE_CLASS: Record<OrchTabShape, string> = {
  sm: 'rounded-lg px-3 py-1.5 text-[11px]',
  md: 'rounded-xl px-3.5 py-2 text-xs',
  pill: 'rounded-full px-3 py-1.5 text-xs',
  mono: 'rounded-full px-3 py-1 font-mono text-[11px]',
  compact: 'rounded-lg px-2.5 py-1.5 text-[11px]',
};
const IDLE_CLASS = 'border-slate-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-white/10';

/** The theme-aware tab / choice strip of the orchestration pages (shared ChipGroup with the theme's accent). */
export function OrchTabs<T extends string | number>({ value, options, onChange, theme, role = 'tab', shape = 'sm', label, nowrap, className = '' }: Props<T>): React.ReactElement {
  return (
    <ChipGroup
      value={value}
      options={options}
      onChange={onChange}
      role={role}
      label={label}
      nowrap={nowrap}
      gapClassName="gap-1.5"
      className={className}
      chipClassName={`inline-flex items-center gap-1.5 transition-colors ${SHAPE_CLASS[shape]}`}
      selectedClassName={theme.accentBg}
      idleClassName={IDLE_CLASS}
    />
  );
}
