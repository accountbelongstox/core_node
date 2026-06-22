import React from 'react';

interface HoloCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export const HoloCard: React.FC<HoloCardProps> = ({ children, className = '', onClick, isActive = false }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/40 backdrop-blur-xl
        border border-white/60
        shadow-[0_8px_32px_0_rgba(255,255,255,0.3)]
        transition-all duration-300 ease-out
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${isActive 
          ? 'ring-2 ring-purple-300 scale-[1.02] bg-white/60 shadow-[0_8px_32px_0_rgba(168,85,247,0.2)]' 
          : 'hover:bg-white/50 hover:shadow-[0_8px_32px_0_rgba(150,150,255,0.2)]'}
        ${className}
      `}
    >
      {/* Iridescent Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-purple-100/20 pointer-events-none" />
      
      {/* Glass Reflection Shine */}
      <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-transparent via-white/20 to-transparent rotate-45 pointer-events-none" />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
