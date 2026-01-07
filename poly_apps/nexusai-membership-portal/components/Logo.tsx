
import React from 'react';

const Logo = ({ className = "", showText = true }: { className?: string, showText?: boolean }) => (
  <div className={`flex items-center gap-3 group ${className}`}>
    <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center font-bold italic text-white shadow-2xl transition-all group-hover:rotate-12 group-hover:scale-110">
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    {showText && (
      <span className="font-extrabold text-2xl tracking-tighter dark:text-white text-slate-900">
        toprouter<span className="text-blue-500">.cn</span>
      </span>
    )}
  </div>
);

export default Logo;

