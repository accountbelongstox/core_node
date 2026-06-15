/**
 * useUnifiedApp Hook
 *
 * Custom hook to access the unified app state.
 * Separated from the Provider component module to keep that
 * module Fast-Refresh-pure.
 *
 * @example
 * const { theme, toggleTheme, user, login, logout } = useUnifiedApp();
 */

import { useContext } from 'react';
import { UnifiedAppContext } from './unifiedAppContext.core';
import type { UnifiedAppContextType, UnifiedAppState } from './unifiedAppContext.core';

/**
 * Custom Hook - Use Unified App State
 */
export const useUnifiedApp = (): UnifiedAppContextType => {
  const context = useContext(UnifiedAppContext);
  if (!context) {
    throw new Error('useUnifiedApp must be used within UnifiedAppProvider');
  }
  return context;
};

/**
 * Re-export types for convenience
 */
export type { UnifiedAppState, UnifiedAppContextType };
