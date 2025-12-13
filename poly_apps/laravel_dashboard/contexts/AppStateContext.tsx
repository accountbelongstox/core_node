/**
 * 中心化应用状态管理 - App State Context
 *
 * 功能：
 * 1. 管理应用全局状态（activeView, theme, lang, isLoggedIn等）
 * 2. localStorage 持久化，刷新后自动恢复状态
 * 3. 统一的状态更新接口
 * 4. TypeScript 类型安全
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ViewType, Language, Theme } from '../types';

/**
 * 应用状态接口
 */
interface AppState {
  activeView: ViewType;
  lang: Language;
  theme: Theme;
  isLoggedIn: boolean;
  lastVisitedView?: ViewType;
}

/**
 * Context 类型定义
 */
interface AppStateContextType {
  // 状态
  activeView: ViewType;
  lang: Language;
  theme: Theme;
  isLoggedIn: boolean;

  // 更新方法
  setActiveView: (view: ViewType) => void;
  setLang: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleLang: () => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;

  // 批量更新
  updateState: (updates: Partial<AppState>) => void;

  // 重置
  resetState: () => void;
}

/**
 * 默认状态
 */
const DEFAULT_STATE: AppState = {
  activeView: ViewType.MEDIA_BROWSER,
  lang: 'en',
  theme: 'dark',
  isLoggedIn: false,
  lastVisitedView: ViewType.MEDIA_BROWSER
};

/**
 * LocalStorage 键名
 */
const STORAGE_KEY = 'dashboard_app_state';

/**
 * 从 localStorage 加载状态
 */
const loadStateFromStorage = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        activeView: parsed.activeView || DEFAULT_STATE.activeView,
        lang: parsed.lang || DEFAULT_STATE.lang,
        theme: parsed.theme || DEFAULT_STATE.theme,
        isLoggedIn: parsed.isLoggedIn || DEFAULT_STATE.isLoggedIn,
        lastVisitedView: parsed.lastVisitedView || parsed.activeView || DEFAULT_STATE.lastVisitedView
      };
    }
  } catch (error) {
    console.error('[AppStateContext] Failed to load state from localStorage:', error);
  }
  return DEFAULT_STATE;
};

/**
 * 保存状态到 localStorage
 */
const saveStateToStorage = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[AppStateContext] State saved to localStorage:', state.activeView);
  } catch (error) {
    console.error('[AppStateContext] Failed to save state to localStorage:', error);
  }
};

/**
 * 创建 Context
 */
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

/**
 * Provider Props
 */
interface AppStateProviderProps {
  children: ReactNode;
}

/**
 * App State Provider
 */
export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  // 初始化状态 - 从 localStorage 加载
  const [state, setState] = useState<AppState>(() => {
    const loadedState = loadStateFromStorage();
    console.log('[AppStateContext] Initial state loaded:', loadedState);
    return loadedState;
  });

  // 状态变化时自动保存到 localStorage
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // 应用主题到 DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    console.log('[AppStateContext] Theme applied:', state.theme);
  }, [state.theme]);

  // 设置 activeView - 同时更新 lastVisitedView
  const setActiveView = useCallback((view: ViewType) => {
    setState(prev => ({
      ...prev,
      activeView: view,
      lastVisitedView: view
    }));
    console.log('[AppStateContext] Active view changed to:', view);
  }, []);

  // 设置语言
  const setLang = useCallback((lang: Language) => {
    setState(prev => ({ ...prev, lang }));
    console.log('[AppStateContext] Language changed to:', lang);
  }, []);

  // 设置主题
  const setTheme = useCallback((theme: Theme) => {
    setState(prev => ({ ...prev, theme }));
    console.log('[AppStateContext] Theme changed to:', theme);
  }, []);

  // 切换主题
  const toggleTheme = useCallback(() => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));
  }, []);

  // 切换语言
  const toggleLang = useCallback(() => {
    setState(prev => ({
      ...prev,
      lang: prev.lang === 'en' ? 'zh' : 'en'
    }));
  }, []);

  // 设置登录状态
  const setIsLoggedIn = useCallback((isLoggedIn: boolean) => {
    setState(prev => ({ ...prev, isLoggedIn }));
    console.log('[AppStateContext] Login status changed to:', isLoggedIn);
  }, []);

  // 批量更新状态
  const updateState = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
    console.log('[AppStateContext] State updated:', updates);
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setState(DEFAULT_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[AppStateContext] State reset to defaults');
    } catch (error) {
      console.error('[AppStateContext] Failed to remove state from localStorage:', error);
    }
  }, []);

  const value: AppStateContextType = {
    // 状态
    activeView: state.activeView,
    lang: state.lang,
    theme: state.theme,
    isLoggedIn: state.isLoggedIn,

    // 更新方法
    setActiveView,
    setLang,
    setTheme,
    toggleTheme,
    toggleLang,
    setIsLoggedIn,
    updateState,
    resetState
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

/**
 * 自定义 Hook - 使用应用状态
 *
 * @example
 * const { activeView, setActiveView, theme, toggleTheme } = useAppState();
 */
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

/**
 * 导出类型供外部使用
 */
export type { AppState, AppStateContextType };
