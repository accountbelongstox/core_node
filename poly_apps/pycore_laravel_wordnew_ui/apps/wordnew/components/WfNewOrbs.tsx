/** WfNewOrbs - decorative luminous background orbs extracted from WfNewApp
 * so the shell stays under the 800-line modular limit. Drift runs as compositor-only CSS keyframes. */
import React from 'react';

const ORB_COLORS = {
  upper: { dark: 'rgba(79, 70, 229, 0.14)', light: 'rgba(192, 160, 250, 0.32)' },
  middle: { dark: 'rgba(192, 38, 211, 0.1)', light: 'rgba(251, 150, 190, 0.3)' },
  bottom: { dark: 'rgba(5, 150, 105, 0.1)', light: 'rgba(110, 231, 183, 0.28)' },
} as const;

const ORB_KEYFRAMES =
  '@keyframes wfnewOrbA{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(25px,-40px,0) scale(1.15)}50%{transform:translate3d(-20px,20px,0) scale(0.95)}75%{transform:translate3d(10px,-10px,0) scale(1.05)}}' +
  '@keyframes wfnewOrbB{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(-35px,50px,0) scale(0.85)}50%{transform:translate3d(20px,-20px,0) scale(1.1)}75%{transform:translate3d(-10px,25px,0) scale(0.95)}}' +
  '@keyframes wfnewOrbC{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(30px,40px,0) scale(1.2)}50%{transform:translate3d(-20px,-30px,0) scale(0.9)}75%{transform:translate3d(15px,10px,0) scale(1.1)}}';

const orbStyle = (
  orb: keyof typeof ORB_COLORS,
  dark: boolean,
  anim: string,
  seconds: number,
  delay: number,
  animate: boolean,
): React.CSSProperties => ({
  backgroundImage: `radial-gradient(closest-side, ${ORB_COLORS[orb][dark ? 'dark' : 'light']}, transparent)`,
  willChange: animate ? 'transform' : undefined,
  animation: animate ? `${anim} ${seconds}s ease-in-out ${delay}s infinite` : undefined,
});

interface WfNewOrbsProps {
  disableBgBreathing: boolean;
  dark: boolean;
}

export const WfNewOrbs: React.FC<WfNewOrbsProps> = ({ disableBgBreathing, dark }) => {
  const animate = !disableBgBreathing;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style>{ORB_KEYFRAMES}</style>
      <div
        className="absolute top-[-10%] right-[5%] w-[600px] h-[600px] rounded-full"
        style={orbStyle('upper', dark, 'wfnewOrbA', 12, 0, animate)}
      />
      <div
        className="absolute top-[35%] left-[-15%] w-[520px] h-[520px] rounded-full"
        style={orbStyle('middle', dark, 'wfnewOrbB', 15, 1, animate)}
      />
      <div
        className="absolute bottom-[10%] right-[-15%] w-[560px] h-[560px] rounded-full"
        style={orbStyle('bottom', dark, 'wfnewOrbC', 14, 2, animate)}
      />
    </div>
  );
};
