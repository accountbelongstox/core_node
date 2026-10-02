import React from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  /** 0..1 */
  progress: number;
  /** Tailwind size classes of the box (default w-20 h-20). */
  sizeClass?: string;
  radius?: number;
  strokeWidth?: number;
  /** Text colour class of the arc (stroke is currentColor). */
  colorClass?: string;
  durationSec?: number;
  children?: React.ReactNode;
}

const VIEW_SIZE = 100;
const CENTER = VIEW_SIZE / 2;

/** Animated circular gauge; children render centred inside the ring. */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress, sizeClass = 'h-20 w-20', radius = 42, strokeWidth = 8, colorClass = 'text-indigo-400', durationSec = 0.9, children,
}) => {
  const circumference = 2 * Math.PI * radius;
  const share = Math.min(1, Math.max(0, progress));
  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="h-full w-full -rotate-90">
        <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-white/10" />
        <motion.circle
          cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
          className={colorClass}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - share) }}
          transition={{ duration: durationSec, ease: 'easeOut' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
};
