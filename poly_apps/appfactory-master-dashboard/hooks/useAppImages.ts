/**
 * Custom hook for loading encrypted app icons and splashes
 * 
 * This hook centralizes the logic for loading encrypted app images based on the pp= parameter.
 * It automatically reloads images when the password changes.
 * 
 * Features:
 * - Loads app icon and splash in parallel
 * - Automatically reloads when password changes (via usePasswordChange)
 * - Handles errors gracefully
 * - Returns loading states and URLs
 */

import { useState, useEffect } from 'react';
import { AppInstance } from '../types';
import { encryptedImageService } from '../services/encryptedImageService';
import { usePasswordChange } from './usePasswordChange';
import { i18nService } from '../services/i18nService';

export interface UseAppImagesResult {
  iconUrl: string | null;
  splashUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to load encrypted app icon and splash images
 * 
 * @param app - App instance with icon and splash paths
 * @returns Object containing iconUrl, splashUrl, isLoading, and error
 */
export function useAppImages(app: AppInstance | null | undefined): UseAppImagesResult {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Monitor password changes - reload images when password changes
  const password = usePasswordChange();

  useEffect(() => {
    const loadImages = async () => {
      if (!app) {
        setIconUrl(null);
        setSplashUrl(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Clear previous URLs to force reload with new password
        setIconUrl(null);
        setSplashUrl(null);
        
        // Load icon and splash in parallel
        const [icon, splash] = await Promise.all([
          app.icon 
            ? encryptedImageService.loadAppIcon(app.id, app.icon).catch(err => {
                console.error(`[useAppImages] Failed to load icon for ${app.id}:`, err);
                return null;
              })
            : Promise.resolve(null),
          app.splash 
            ? encryptedImageService.loadAppSplash(app.id, app.splash).catch(err => {
                console.error(`[useAppImages] Failed to load splash for ${app.id}:`, err);
                return null;
              })
            : Promise.resolve(null),
        ]);
        
        setIconUrl(icon);
        setSplashUrl(splash);
      } catch (err) {
        console.error(`[useAppImages] Error loading images for ${app.id}:`, err);
        setError(err instanceof Error ? err : new Error(i18nService.t('common.unknownError')));
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, [app?.id, app?.icon, app?.splash, password]); // Reload when password changes

  return {
    iconUrl,
    splashUrl,
    isLoading,
    error,
  };
}

