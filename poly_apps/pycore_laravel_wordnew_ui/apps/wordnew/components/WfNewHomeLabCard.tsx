import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type WfNewHomeLabTone = 'pink' | 'blue' | 'green' | 'peach' | 'violet' | 'cyan';

/** Soft pastel widget fills (light) and deep tinted glass (dark). */
const TONE_CLASSES: Record<WfNewHomeLabTone, string> = {
  pink: 'from-pink-100 via-fuchsia-50 to-white dark:from-pink-500/25 dark:via-fuchsia-500/10 dark:to-slate-900/40',
  blue: 'from-sky-200 via-blue-50 to-white dark:from-sky-500/25 dark:via-blue-500/10 dark:to-slate-900/40',
  green: 'from-lime-200 via-lime-50 to-white dark:from-lime-400/20 dark:via-emerald-500/10 dark:to-slate-900/40',
  peach: 'from-orange-100 via-amber-50 to-white dark:from-orange-400/20 dark:via-amber-500/10 dark:to-slate-900/40',
  violet: 'from-violet-200 via-indigo-50 to-white dark:from-violet-500/25 dark:via-indigo-500/10 dark:to-slate-900/40',
  cyan: 'from-cyan-100 via-teal-50 to-white dark:from-cyan-400/20 dark:via-teal-500/10 dark:to-slate-900/40',
};

const ICON_TONE: Record<WfNewHomeLabTone, string> = {
  pink: 'text-pink-500', blue: 'text-sky-500', green: 'text-lime-600 dark:text-lime-300',
  peach: 'text-orange-500', violet: 'text-violet-500', cyan: 'text-cyan-500',
};

interface WfNewHomeLabCardProps {
  tone: WfNewHomeLabTone;
  /** 3D illustration URL; the icon is the fallback. */
  art?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Black pill call to action (the card itself stays clickable). */
  action?: string;
  onOpen: () => void;
  /** `wide`: text left, art right (spans two columns); `tile`: art on top. */
  layout?: 'wide' | 'tile';
  className?: string;
}

const Art: React.FC<{ art?: string; icon: LucideIcon; tone: WfNewHomeLabTone; size: string }> = ({ art, icon: Icon, tone, size }) => (
  art ? (
    <img
      src={art}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`${size} shrink-0 object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.18)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2`}
    />
  ) : (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-3xl bg-white/70 shadow-inner ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10 ${ICON_TONE[tone]}`}>
      <Icon className="h-1/2 w-1/2" />
    </span>
  )
);

/** Home bento widget: a soft gradient card with a 3D illustration, bold title and an optional pill action. */
export const WfNewHomeLabCard: React.FC<WfNewHomeLabCardProps> = ({
  tone, art, icon, title, description, action, onOpen, layout = 'tile', className = '',
}) => {
  const wide = layout === 'wide';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}
      className={`group relative min-w-0 cursor-pointer select-none overflow-hidden rounded-[1.6rem] bg-gradient-to-b ${TONE_CLASSES[tone]} ring-1 ring-inset ring-white/70 dark:ring-white/10 transition-transform duration-300 active:scale-[0.98] ${
        wide ? 'flex items-center gap-3 p-4 sm:p-5' : 'flex flex-col items-center p-3 pt-4 text-center sm:p-4'
      } ${className}`}
    >
      {wide ? (
        <>
          <div className="min-w-0 flex-1">
            <h4 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xl">{title}</h4>
            {description && <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-300/80">{description}</p>}
            {action && (
              <span className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">{action}</span>
            )}
          </div>
          <Art art={art} icon={icon} tone={tone} size="h-24 w-24 sm:h-28 sm:w-28" />
        </>
      ) : (
        <>
          <Art art={art} icon={icon} tone={tone} size="h-16 w-16 sm:h-20 sm:w-20" />
          <h4 className="mt-2 line-clamp-2 w-full text-sm font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{title}</h4>
          {description && (
            <p className="mt-1 hidden w-full sm:block">
              <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300/80">{description}</span>
            </p>
          )}
          {action && (
            <span className="mt-2.5 inline-flex rounded-full bg-slate-900 px-3.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">{action}</span>
          )}
        </>
      )}
    </div>
  );
};

/** The white (dark: glass) tray a bento of cards sits in. */
export const WfNewHomeBento: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`grid gap-2 rounded-[2rem] bg-white/85 p-2 shadow-[0_10px_34px_-14px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10 ${className}`}>
    {children}
  </div>
);
