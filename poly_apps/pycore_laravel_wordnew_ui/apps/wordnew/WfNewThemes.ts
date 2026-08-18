export interface ElementTheme {
  id: string;
  nameEn: string;
  nameZh: string;
  bgClass: string;
  cardClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  accentText: string;
  accentBg: string;
  borderClass: string;
  glowClass: string;
  inputClass: string;
}

export const CUSTOM_THEMES: ElementTheme[] = [
  {
    id: 'cosmic',
    nameEn: 'Astral Nebula',
    nameZh: '幽邃星云',
    bgClass: 'bg-gradient-to-br from-[#f1ecfc] via-[#f7f5ff] to-[#eae5f8] dark:from-[#0c051d] dark:via-[#100b26] dark:to-[#040108]',
    cardClass: 'bg-white border-2 border-indigo-200 dark:bg-indigo-950/25 dark:border-indigo-500/15 text-indigo-950 dark:text-indigo-100 shadow-xl dark:shadow-2xl transition-all duration-350 hover:shadow-2xl hover:border-fuchsia-400 dark:hover:border-fuchsia-500/35',
    textPrimaryClass: 'text-indigo-950 dark:text-white',
    textSecondaryClass: 'text-zinc-750 dark:text-indigo-200/70',
    accentText: 'text-fuchsia-700 dark:text-fuchsia-400',
    accentBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-500/20',
    borderClass: 'border-indigo-250 dark:border-indigo-500/20',
    glowClass: 'shadow-[0_4px_25px_rgba(168,85,247,0.12)] dark:shadow-[0_0_25px_rgba(168,85,247,0.15)] bg-radial-purple',
    inputClass: 'bg-white dark:bg-indigo-950/40 border-2 border-indigo-300 dark:border-indigo-500/20 text-indigo-950 dark:text-indigo-100 focus:border-fuchsia-500 dark:focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20'
  },
  {
    id: 'aurora',
    nameEn: 'Emerald Aurora',
    nameZh: '极光之境',
    bgClass: 'bg-gradient-to-br from-[#e4f9ee] via-[#ecfdf3] to-[#e0f7eb] dark:from-[#031511] dark:via-[#07241d] dark:to-[#010705]',
    cardClass: 'bg-white border-2 border-emerald-250 dark:bg-emerald-950/25 dark:border-emerald-500/15 text-emerald-955 dark:text-emerald-100 shadow-xl dark:shadow-2xl transition-all duration-350 hover:shadow-2xl hover:border-teal-400 dark:hover:border-teal-400/30',
    textPrimaryClass: 'text-emerald-950 dark:text-white',
    textSecondaryClass: 'text-zinc-750 dark:text-emerald-200/70',
    accentText: 'text-emerald-700 dark:text-emerald-400',
    accentBg: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/20',
    borderClass: 'border-emerald-250 dark:border-emerald-500/20',
    glowClass: 'shadow-[0_4px_25px_rgba(16,185,129,0.12)] dark:shadow-[0_0_25px_rgba(16,185,129,0.15)] bg-radial-mint',
    inputClass: 'bg-white/90 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-500/20 text-emerald-950 dark:text-emerald-100 focus:border-teal-500 dark:focus:border-teal-400/50 focus:ring-1 focus:ring-teal-400/20'
  },
  {
    id: 'sunset',
    nameEn: 'Sunset Boulevard',
    nameZh: '落日霞光',
    bgClass: 'bg-gradient-to-br from-[#fdf0dd] via-[#fffbf0] to-[#fcead7] dark:from-[#1b0a09] dark:via-[#2f130c] dark:to-[#0b0403]',
    cardClass: 'bg-white border-2 border-orange-250 dark:bg-amber-950/25 dark:border-orange-500/15 text-orange-955 dark:text-orange-100 shadow-xl dark:shadow-2xl transition-all duration-350 hover:shadow-2xl hover:border-amber-400 dark:hover:border-amber-400/30',
    textPrimaryClass: 'text-orange-950 dark:text-white',
    textSecondaryClass: 'text-zinc-755 dark:text-orange-200/70',
    accentText: 'text-orange-700 dark:text-orange-400',
    accentBg: 'bg-orange-100 dark:bg-orange-500/15 text-orange-850 dark:text-orange-300 border border-orange-200 dark:border-orange-500/20',
    borderClass: 'border-orange-250 dark:border-orange-500/20',
    glowClass: 'shadow-[0_4px_25px_rgba(249,115,22,0.12)] dark:shadow-[0_0_25px_rgba(249,115,22,0.15)] bg-radial-sunset',
    inputClass: 'bg-white/90 dark:bg-orange-950/40 border-2 border-orange-300 dark:border-orange-500/20 text-orange-950 dark:text-orange-100 focus:border-amber-550 dark:focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20'
  },
  {
    id: 'nordic',
    nameEn: 'Minimal Nordic Slate',
    nameZh: '北欧极简岩板',
    bgClass: 'bg-gradient-to-br from-[#f1f5f9] via-[#f8fafc] to-[#cbd5e1] dark:from-[#0b0f19] dark:via-[#111827] dark:to-[#030712]',
    cardClass: 'bg-white dark:bg-slate-900/40 border-2 border-slate-300 dark:border-slate-800/60 text-slate-800 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-700 shadow-md dark:shadow-xl transition-all duration-350',
    textPrimaryClass: 'text-slate-950 dark:text-slate-100',
    textSecondaryClass: 'text-slate-700 dark:text-slate-400',
    accentText: 'text-indigo-700 dark:text-indigo-400',
    accentBg: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-850 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20',
    borderClass: 'border-indigo-250 dark:border-indigo-500/20',
    glowClass: 'shadow-[0_4px_25px_rgba(0,0,0,0.05)] dark:shadow-[0_0_25px_rgba(99,102,241,0.08)] bg-radial-nordic',
    inputClass: 'bg-white dark:bg-slate-900/50 border-2 border-slate-300 dark:border-slate-800 text-slate-950 dark:text-slate-100 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20'
  }
];
