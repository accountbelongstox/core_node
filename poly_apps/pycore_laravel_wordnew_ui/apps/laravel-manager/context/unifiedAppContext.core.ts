/**
 * Unified App Context - Core
 *
 * Holds the React context object and the shared type definitions.
 * Kept separate from the Provider component so that the Provider
 * module stays Fast-Refresh-pure (component-only export).
 */

import { createContext } from 'react';
import { ViewType, Language, Theme } from '../uiTypes';
import { UnifiedUser, UserPreferences } from '../types';

/**
 * Unified App State Interface
 */
export interface UnifiedAppState {
  // App State
  activeView: ViewType;
  lang: Language;
  theme: Theme;

  // UnifiedUser State
  UnifiedUser: UnifiedUser | null;
  isLoggedIn: boolean;
  preferences: UserPreferences;

  // Loading & Error
  loading: boolean;
  error: string | null;
}

/**
 * Unified App Context Type
 */
export interface UnifiedAppContextType {
  // State
  activeView: ViewType;
  lang: Language;
  theme: Theme;
  UnifiedUser: UnifiedUser | null;
  isLoggedIn: boolean;
  preferences: UserPreferences;
  loading: boolean;
  error: string | null;

  // App Actions
  setActiveView: (view: ViewType) => void;
  setLang: (lang: Language, reload?: boolean) => void;
  setTheme: (theme: Theme, reload?: boolean) => void;
  toggleTheme: (reload?: boolean) => void;
  toggleLang: (reload?: boolean) => void;

  // UnifiedUser Actions
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string, nickname?: string, registrationCode?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  refreshUser: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>;
  addRecentTool: (toolId: string) => void;
  toggleFavorite: (toolId: string) => void;
  isFavorite: (toolId: string) => boolean;

  // Utility Actions
  clearError: () => void;
  refreshState: () => void;
  resetAll: () => void;
}

/**
 * Unified App Context object
 */
export const UnifiedAppContext = createContext<UnifiedAppContextType | undefined>(undefined);

