/**
 * Reusable component for displaying app icons and splashes
 * 
 * This component handles the display of encrypted app images with proper fallbacks.
 * It uses the useAppImages hook to load images based on the pp= parameter.
 * 
 * Features:
 * - Displays splash screen if available, falls back to icon, then to initial letter
 * - Handles image loading errors gracefully
 * - Supports different display sizes and styles
 * - Uses translation system for alt text
 */

import React, { useState } from 'react';
import { AppInstance } from '../types';
import { useAppImages } from '../hooks/useAppImages';
import { useApp } from '../contexts/AppContext';

export interface AppImageDisplayProps {
  app: AppInstance;
  /**
   * Display mode: 'card' shows splash with icon fallback, 'icon-only' shows only icon
   */
  mode?: 'card' | 'icon-only';
  /**
   * Size for icon-only mode
   */
  iconSize?: 'small' | 'medium' | 'large';
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Custom className for the splash image
   */
  splashClassName?: string;
  /**
   * Custom className for the icon image
   */
  iconClassName?: string;
  /**
   * Whether to show a gradient background when no image is available
   */
  showGradient?: boolean;
}

/**
 * Component for displaying app images (icon and splash) with fallbacks
 */
export const AppImageDisplay: React.FC<AppImageDisplayProps> = ({
  app,
  mode = 'card',
  iconSize = 'medium',
  className = '',
  splashClassName = '',
  iconClassName = '',
  showGradient = true,
}) => {
  const { t } = useApp();
  const { iconUrl, splashUrl, isLoading } = useAppImages(app);
  const [showSplash, setShowSplash] = useState(true);
  const [showIcon, setShowIcon] = useState(true);

  // Icon size classes
  const iconSizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-24 h-24',
    large: 'w-32 h-32',
  };

  // Card mode: shows splash with icon fallback
  if (mode === 'card') {
    return (
      <div className={className || 'h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden'}>
        {splashUrl && showSplash ? (
          <img
            src={splashUrl}
            alt={t('apps.splashImage', { appName: app.name })}
            className={splashClassName || 'w-full h-full object-cover'}
            onError={() => setShowSplash(false)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${showGradient ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : ''}`}>
            {iconUrl && showIcon ? (
              <img
                src={iconUrl}
                alt={t('apps.iconImage', { appName: app.name })}
                className={iconClassName || 'w-24 h-24 rounded-xl'}
                onError={() => setShowIcon(false)}
              />
            ) : (
              <span className="text-white text-4xl font-bold">
                {app.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Icon-only mode: shows only the icon
  return (
    <div className={`${className} ${iconSizeClasses[iconSize]} rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0`}>
      {isLoading ? (
        <div className="w-full h-full bg-slate-200 dark:bg-slate-600 animate-pulse" />
      ) : iconUrl && showIcon ? (
        <img
          src={iconUrl}
          alt={t('apps.iconImage', { appName: app.name })}
          className={`${iconClassName} w-full h-full object-cover`}
          onError={() => setShowIcon(false)}
        />
      ) : (
        <span className="text-slate-600 dark:text-slate-300 text-xl font-bold">
          {app.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

