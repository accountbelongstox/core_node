/* [v4.1-Iris] wfAppContextCore — the ONE stable home of the WfApp context
 * object (+ its type). Deliberately tiny and edit-cold:
 *
 * WfAppContext.tsx mixes a provider component, hooks and helpers, so Vite's
 * react-refresh cannot treat it as a self-accepting boundary — every HMR
 * invalidation re-evaluates it. If `createContext` lived there, each refresh
 * would mint a NEW context object while already-mounted consumers (WfLayout/
 * WfTopBar) could still read the OLD one, making useWfApp() throw
 * "useWfApp must be used within <WfAppProvider>" mid-refresh.
 *
 * Keeping `createContext` here (and pinning the instance on globalThis so even
 * a re-evaluation of THIS module reuses the same object) makes the context
 * identity immune to HMR. Do NOT add components, hooks or frequently edited
 * code to this file. Public imports stay on './WfAppContext', which re-exports
 * the type. */
import { createContext, type Context } from 'react';
import type { User } from '../../core/api-libs/wordflow/wordflowTypes';

export interface WfAppContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Current learning (target) language code, e.g. 'en' | 'zh'. */
  learningLanguage: string;
  setLearningLanguage: (lang: string) => void;
  /** Active study group id (persisted). */
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User | null) => void;
  /** Translation helper bound to the shell language. */
  t: (key: string, replacements?: Record<string, string | number>) => string;
  /** Active app language (mirrors useShell().lang). */
  lang: string;
}

type WfAppReactContext = Context<WfAppContextType | null>;

/** HMR-stable singleton: survives even a re-evaluation of this module. */
const globalStore = globalThis as { __WF_APP_CONTEXT__?: WfAppReactContext };

export const WfAppContext: WfAppReactContext =
  globalStore.__WF_APP_CONTEXT__ ??
  (globalStore.__WF_APP_CONTEXT__ = createContext<WfAppContextType | null>(null));
