import React, { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface AuthLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  showHeader = true,
  title,
  subtitle,
}) => {
  // Initialize Capacitor status bar
  useEffect(() => {
    const initCapacitor = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setOverlaysWebView({ overlay: true });
        } catch (error) {
          console.log('[AuthLayout] StatusBar not available:', error);
        }
      }
    };

    initCapacitor();
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-8 pt-safe animate-fade-in"
      style={{ paddingTop: `calc(2rem + env(safe-area-inset-top, 0px))` }}
    >
      {showHeader && (
        <>
          <div className="w-24 h-24 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-3xl shadow-2xl mb-8 flex items-center justify-center text-4xl text-white font-bold transform rotate-6 animate-blob">
            W
          </div>
          {title && (
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-slate-500 dark:text-slate-300 mb-10 text-center">
              {subtitle}
            </p>
          )}
        </>
      )}
      <div className="w-full max-w-sm ds-glass ds-glass-edge rounded-[var(--radius-card)] p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
};

