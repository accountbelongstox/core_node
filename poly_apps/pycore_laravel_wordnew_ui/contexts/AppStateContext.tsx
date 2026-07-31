/**
 * App State Context - Centralized Application State Management
 *
 * MIGRATED TO UNIFIED APP CONTEXT
 *
 * This file now exports from UnifiedAppContext for backward compatibility
 *
 * Features integrated into UnifiedAppContext:
 * 1. Manage global app state (activeView, theme, lang, isLoggedIn, etc.)
 * 2. localStorage persistence, auto-restore state after refresh
 * 3. Unified state update interface
 * 4. TypeScript type safety
 * 5. User data management (integrated useUser)
 * 6. Page refresh mechanism (settings changes take effect immediately)
 */

export { useAppState } from '../hooks/compatibilityHooks';
export { UnifiedAppProvider as AppStateProvider } from '@/apps/laravel-manager/context/UnifiedAppContext';
