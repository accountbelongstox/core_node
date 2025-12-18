import React, { createContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMount } from 'react-use';
import { User, AppSettings, DEFAULT_SETTINGS, PlaylistSettings, DEFAULT_PLAYLIST_SETTINGS } from '../types';
import { api } from '../services/api';
import { I18N_DICT } from '../services/mockData';
import { apiManager } from '../services/ApiManager';
import { SettingsCenter } from '../services/SettingsCenter';
import { LanguageCenter } from '../i18n/LanguageCenter';
import { StorageCenter, StorageKey } from '../services/StorageCenter';
import { StateManager, GlobalState } from '../services/StateManager';
import { AuthModel } from '../models/AuthModel';
import { UserModel } from '../models/UserModel';
import { UserProfileEnsurer } from '../services/UserProfileEnsurer';

interface AppContextType {
  user: User | null;
  settings: AppSettings;
  playlistSettings: PlaylistSettings;
  activeGroupId: string; // NEW: Tracks the currently selected book
  setActiveGroupId: (id: string) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  updatePlaylistSettings: (s: Partial<PlaylistSettings>) => void;
  navigate: (page: string, params?: any) => void;
  currentPage: string;
  currentParams: any;
  t: (key: string) => string;
  logout: () => void;
  login: (u: User) => void;
  setUser: (u: User) => void;
}

export const AppContext = createContext<AppContextType>({} as any);

export const AppProvider = ({ children }: { children?: React.ReactNode }) => {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const [user, setUserState] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playlistSettings, setPlaylistSettings] = useState<PlaylistSettings>(DEFAULT_PLAYLIST_SETTINGS);
  const [activeGroupId, setActiveGroupId] = useState<string>('g1');
  const [currentParams, setCurrentParams] = useState<any>({});

  // Initialize all centers
  useEffect(() => {
    console.log('[AppContext] Initializing...');

    // 0. Initialize UserModel from storage FIRST
    UserModel.init();
    console.log('[AppContext] UserModel initialized from storage');

    // 1. Initialize API Manager
    apiManager.initialize({ autoDetect: true, timeout: 1000 }).catch(err => {
      console.error('[AppContext] Failed to initialize API Manager:', err);
    });

    // 2. Initialize Settings Center
    const initialSettings = SettingsCenter.initialize();
    setSettings(initialSettings);

    // 3. Subscribe to settings changes
    const unsubscribeSettings = SettingsCenter.onChange((newSettings) => {
      setSettings(newSettings);
      
      // Apply theme changes immediately
      const theme = newSettings.display.theme;
      if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });

    // Apply initial theme
    const initialTheme = initialSettings.display.theme;
    if (initialTheme === 'dark' || (initialTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 4. Subscribe to language changes
    const unsubscribeLang = LanguageCenter.subscribe((lang) => {
      console.log('[AppContext] Language changed to:', lang);
    });

    // 5. Load user from storage and validate
    const initAuth = async () => {
      const storedUser = StorageCenter.auth.getUser();
      const storedToken = StorageCenter.auth.getToken();

      if (storedUser && storedToken) {
        console.log('[AppContext] Found stored user:', storedUser.username);
        setUserState(storedUser);
        StateManager.set(GlobalState.USER, storedUser);
        StateManager.set(GlobalState.IS_LOGGED_IN, true);

        // Validate session
        const isValid = await AuthModel.validateSession();
        if (isValid) {
          console.log('[AppContext] Session valid, navigating to home');
          if (location.pathname === '/login' || location.pathname === '/') {
            routerNavigate('/home');
          }
        } else {
          console.log('[AppContext] Session invalid, staying on login');
          setUserState(null);
          routerNavigate('/login');
        }
      } else {
        console.log('[AppContext] No stored auth, staying on login');
        if (location.pathname !== '/login') {
          routerNavigate('/login');
        }
      }
    };

    initAuth();

    // 6. Load playlist settings from Storage Center
    const savedPlaylist = StorageCenter.settings.getPlaylist();
    if (savedPlaylist) {
      setPlaylistSettings({ ...DEFAULT_PLAYLIST_SETTINGS, ...savedPlaylist });
    }

    // 7. Load active group
    const savedGroup = StorageCenter.settings.getActiveGroupId();
    setActiveGroupId(savedGroup);

    // Cleanup
    return () => {
      unsubscribeSettings();
      unsubscribeLang();
    };
  }, []);

  const navigate = (page: string, params?: any) => {
    setCurrentParams(params || {});
    // Convert old page names to URL paths
    const path = page.startsWith('/') ? page : `/${page}`;
    routerNavigate(path);
    // React Router automatically handles scroll to top on navigation
  };

  const handleSetActiveGroup = (id: string) => {
    setActiveGroupId(id);
    StorageCenter.settings.setActiveGroupId(id);
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    SettingsCenter.update(partial);
    // Settings will be updated via the subscription
  };

  const updatePlaylistSettings = (partial: Partial<PlaylistSettings>) => {
    const newSettings = { ...playlistSettings, ...partial };
    setPlaylistSettings(newSettings);
    StorageCenter.settings.setPlaylist(newSettings);
  };

  const t = (key: string) => {
    return LanguageCenter.t(key);
  };

  const login = async (u: User) => {
    console.log('[AppContext] Login called with user:', u);
    console.log('[AppContext] User username:', u?.username);

    if (!u) {
      console.error('[AppContext] Login called with null/undefined user!');
      return;
    }

    // Save to state
    console.log('[AppContext] Setting user state...');
    setUserState(u);

    // Save to Storage Center
    console.log('[AppContext] Saving to StorageCenter...');
    StorageCenter.auth.setUser(u);

    // Save to State Manager
    console.log('[AppContext] Saving to StateManager...');
    StateManager.set(GlobalState.USER, u);
    StateManager.set(GlobalState.IS_LOGGED_IN, true);

    // Ensure profile completeness (nickname, avatar)
    console.log('[AppContext] Ensuring profile completeness...');
    UserProfileEnsurer.ensureUserProfile(u).then(result => {
      if (result.updated && result.user) {
        console.log('[AppContext] Profile updated with fields:', result.fields);
        setUserState(result.user);
        StorageCenter.auth.setUser(result.user);
        StateManager.set(GlobalState.USER, result.user);
      }
    }).catch(err => {
      console.error('[AppContext] Profile ensure failed:', err);
    });

    // Navigate to home
    console.log('[AppContext] Navigating to home page...');
    routerNavigate('/home');
  };

  const logout = () => {
    console.log('[AppContext] Logout called');

    // Clear state
    setUserState(null);

    // Clear storage
    StorageCenter.auth.clearAuth();

    // Clear State Manager
    StateManager.set(GlobalState.USER, null);
    StateManager.set(GlobalState.IS_LOGGED_IN, false);

    // Navigate to login
    routerNavigate('/login');
  };

  const setUser = (u: User) => {
    setUserState(u);
    StorageCenter.auth.setUser(u);
    StateManager.set(GlobalState.USER, u);
  };

  // Derive current page from URL pathname
  const currentPage = location.pathname.replace('/', '') || 'home';

  return (
    <AppContext.Provider value={{
      user,
      settings,
      playlistSettings,
      activeGroupId,
      setActiveGroupId: handleSetActiveGroup,
      updateSettings,
      updatePlaylistSettings,
      navigate,
      currentPage,
      currentParams,
      t,
      logout,
      login,
      setUser
    }}>
      {children}
    </AppContext.Provider>
  );
};