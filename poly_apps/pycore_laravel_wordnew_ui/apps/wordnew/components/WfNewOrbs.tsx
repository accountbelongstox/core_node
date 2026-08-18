/** WfNewOrbs - decorative luminous background orbs extracted from WfNewApp
 * so the shell stays under the 800-line modular limit. */
import React from 'react';
import { motion } from 'framer-motion';

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
          className={`absolute top-[-10%] right-[5%] w-[450px] h-[450px] rounded-full filter blur-[120px] transition-colors duration-1000 ${
            dark 
              ? 'bg-indigo-600/10' 
              : 'bg-indigo-400/25 shadow-[inset_0_0_80px_rgba(168,85,247,0.15)] bg-purple-300/20'
          }`}
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
          className={`absolute top-[35%] left-[-5%] w-[380px] h-[380px] rounded-full filter blur-[100px] transition-colors duration-1000 ${
            dark 
              ? 'bg-fuchsia-600/8' 
              : 'bg-pink-400/25 shadow-[inset_0_0_80px_rgba(244,63,94,0.15)] bg-rose-200/20'
          }`}
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
          className={`absolute bottom-[10%] right-[-5%] w-[420px] h-[420px] rounded-full filter blur-[110px] transition-colors duration-1000 ${
            dark 
              ? 'bg-emerald-600/8' 
              : 'bg-emerald-300/25 bg-teal-200/15'
          }`}
        />
      </div>
);
