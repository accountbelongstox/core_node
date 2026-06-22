import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#030305] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        {/* Logo/Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#00f2ff] to-[#bd00ff] flex items-center justify-center relative shadow-[0_0_20px_rgba(0,242,255,0.4)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
          <div className="absolute inset-[2px] bg-black" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
          <div className="w-4 h-4 bg-[#00f2ff] rounded-full z-10 animate-pulse"></div>
        </div>
        
        {/* Loading Text */}
        <div className="text-[#00f2ff] font-mono text-sm tracking-widest animate-pulse">
          加载中...
        </div>
        
        {/* Loading Bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#00f2ff] to-[#bd00ff] rounded-full animate-pulse"
            style={{
              animation: 'loading-bar 1.5s ease-in-out infinite'
            }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

