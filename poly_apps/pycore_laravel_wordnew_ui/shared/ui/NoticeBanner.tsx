import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TONE_TEXT, TONE_TINT, type StatusTone } from './statusTone';

interface NoticeBannerProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatusTone;
  className?: string;
}

/** The one inline notice: a tinted, tone-coloured block with an optional leading icon (hints and warnings). */
export const NoticeBanner: React.FC<NoticeBannerProps> = ({ children, icon: Icon, tone = 'amber', className = '' }) => (
  <div role="note" className={`flex items-start gap-2 rounded-xl border border-current/20 px-3 py-2 text-[11px] leading-snug ${TONE_TINT[tone]} ${TONE_TEXT[tone]} ${className}`}>
    {Icon && <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
    <div className="min-w-0 flex-1 break-words">{children}</div>
  </div>
);
