/** WfNewOrbs - decorative luminous background orbs extracted from WfNewApp
 * so the shell stays under the 800-line modular limit. */
import React from 'react';
import { motion } from 'framer-motion';

const ORB_COLORS = {
  upper: { dark: 'rgba(79, 70, 229, 0.14)', light: 'rgba(192, 160, 250, 0.32)' },
  middle: { dark: 'rgba(192, 38, 211, 0.1)', light: 'rgba(251, 150, 190, 0.3)' },
  bottom: { dark: 'rgba(5, 150, 105, 0.1)', light: 'rgba(110, 231, 183, 0.28)' },
} as const;

const orbFill = (orb: keyof typeof ORB_COLORS, dark: boolean): React.CSSProperties => ({
  backgroundImage: `radial-gradient(closest-side, ${ORB_COLORS[orb][dark ? 'dark' : 'light']}, transparent)`,
  willChange: 'transform',
});

interface WfNewOrbsProps {
  disableBgBreathing: boolean;
  dark: boolean;
}

export const WfNewOrbs: React.FC<WfNewOrbsProps> = ({ disableBgBreathing, dark }) => (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Orb 1: Upper Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.15, 0.95, 1.05, 1],
            x: [0, 25, -20, 10, 0],
            y: [0, -40, 20, -10, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[-10%] right-[5%] w-[600px] h-[600px] rounded-full"
          style={orbFill('upper', dark)}
        />
        {/* Orb 2: Middle Left */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 0.85, 1.1, 0.95, 1],
            x: [0, -35, 20, -10, 0],
            y: [0, 50, -20, 25, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute top-[35%] left-[-15%] w-[520px] h-[520px] rounded-full"
          style={orbFill('middle', dark)}
        />
        {/* Orb 3: Bottom Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.2, 0.9, 1.1, 1],
            x: [0, 30, -20, 15, 0],
            y: [0, 40, -30, 10, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute bottom-[10%] right-[-15%] w-[560px] h-[560px] rounded-full"
          style={orbFill('bottom', dark)}
        />
      </div>
);
