/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { TopBar } from '../TopBar';

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
      className="flex flex-col min-h-full bg-transparent"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <TopBar variant="minimal" />
      <div
        className="flex-1 flex flex-col items-center justify-center p-[max(var(--page-padding-h),env(safe-area-inset-left,0px))] pr-[max(var(--page-padding-h),env(safe-area-inset-right,0px))] pb-[max(var(--page-padding-v),env(safe-area-inset-bottom,0px))] animate-fade-in"
        style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      >
        {showHeader && (
          <>
            <div
              className="w-24 h-24 rounded-[var(--radius-card)] mb-10 flex items-center justify-center text-4xl font-bold transform rotate-6 animate-blob"
              style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}
            >
              W
            </div>
            {title && (
              <h1 className="ds-section-title !text-3xl mb-2 text-center">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-[var(--color-text-secondary)] mb-[var(--space-breath)] text-center">
                {subtitle}
              </p>
            )}
          </>
        )}
        <div className="w-full ds-modal-panel p-6 sm:p-8 max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
};

