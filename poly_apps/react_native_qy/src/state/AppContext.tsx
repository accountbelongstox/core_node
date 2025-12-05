import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import {
  AppSettings,
  DEFAULT_PLAYLIST_SETTINGS,
  DEFAULT_SETTINGS,
  PlaylistSettings,
  User,
} from '../models/types';
import { I18N_DICT, SUPPORTED_LANGUAGES } from '../services/mockData';
import { api } from '../services/api';

export type PageKey =
  | 'login'
  | 'home'
  | 'stats'
  | 'reading_setup'
  | 'reading_run'
  | 'flashcard_run'
  | 'profile'
  | 'settings'
  | 'settings_lang'
  | 'settings_learning'
  | 'settings_display'
  | 'settings_notifications'
  | 'settings_data'
  | 'settings_about'
  | 'courses'
  | 'course_detail'
  | 'upload'
  | 'dictionary'
  | 'leaderboard'
  | 'flashcard_setup'
  | 'settings_privacy'
  | 'review_dashboard'
  | 'quiz_run'
  | 'listening_player'
  | 'word_detail'
  | 'playlist'
  | 'playlist_config'
  | 'friends'
  | 'history';

interface AppContextType {
  isReady: boolean;
  isDark: boolean;
  user: User | null;
  settings: AppSettings;
  playlistSettings: PlaylistSettings;
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  updatePlaylistSettings: (s: Partial<PlaylistSettings>) => void;
  navigate: (page: PageKey, params?: any) => void;
  currentPage: PageKey;
  currentParams: any;
  t: (key: string) => string;
  logout: () => void;
  login: (u: User) => void;
  setUser: (u: User) => void;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const AppContext = createContext<AppContextType>({} as any);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playlistSettings, setPlaylistSettings] = useState<PlaylistSettings>(
    DEFAULT_PLAYLIST_SETTINGS,
  );
  const [activeGroupId, setActiveGroupId] = useState<string>('g1');
  const [currentPage, setCurrentPage] = useState<PageKey>('login');
  const [currentParams, setCurrentParams] = useState<any>({});

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [
          storedToken,
          storedSettings,
          storedPlaylist,
          storedActiveGroup,
          storedUser,
        ] = await Promise.all([
          AsyncStorage.getItem('auth_token'),
          AsyncStorage.getItem('app_settings'),
          AsyncStorage.getItem('playlist_settings'),
          AsyncStorage.getItem('active_group_id'),
          AsyncStorage.getItem('user_profile'),
        ]);

        if (storedSettings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...JSON.parse(storedSettings),
          });
        }
        if (storedPlaylist) {
          setPlaylistSettings({
            ...DEFAULT_PLAYLIST_SETTINGS,
            ...JSON.parse(storedPlaylist),
          });
        }
        if (storedActiveGroup) {
          setActiveGroupId(storedActiveGroup);
        }
        if (storedToken) {
          api.setToken(storedToken);
        }
        if (storedUser) {
          const parsed = JSON.parse(storedUser) as User;
          setUser(parsed);
          setCurrentPage('home');
        }
      } catch (e) {
        console.warn('Failed to bootstrap state', e);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const theme = settings.display.theme;
    if (theme === 'dark') {
      Appearance.setColorScheme?.('dark');
    } else if (theme === 'light') {
      Appearance.setColorScheme?.('light');
    }
  }, [settings.display.theme]);

  const navigate = (page: PageKey, params?: any) => {
    setCurrentParams(params || {});
    setCurrentPage(page);
  };

  const handleSetActiveGroup = (id: string) => {
    setActiveGroupId(id);
    AsyncStorage.setItem('active_group_id', id).catch(() => {});
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    const next = { ...settings };
    if (partial.language) next.language = { ...settings.language, ...partial.language };
    if (partial.audio) next.audio = { ...settings.audio, ...partial.audio };
    if (partial.learning) next.learning = { ...settings.learning, ...partial.learning };
    if (partial.display) next.display = { ...settings.display, ...partial.display };
    if (partial.notifications) {
      next.notifications = { ...settings.notifications, ...partial.notifications };
    }
    setSettings(next);
    AsyncStorage.setItem('app_settings', JSON.stringify(next)).catch(() => {});
    api.syncSettings(next);
  };

  const updatePlaylistSettings = (partial: Partial<PlaylistSettings>) => {
    const next = { ...playlistSettings, ...partial };
    setPlaylistSettings(next);
    AsyncStorage.setItem('playlist_settings', JSON.stringify(next)).catch(() => {});
  };

  const t = (key: string) => {
    const lang = settings.language.appInterface;
    return I18N_DICT[lang]?.[key] || I18N_DICT.en[key] || key;
  };

  const login = (u: User) => {
    setUser(u);
    setCurrentPage('home');
    AsyncStorage.setItem('user_profile', JSON.stringify(u)).catch(() => {});
  };

  const logout = () => {
    setUser(null);
    AsyncStorage.multiRemove(['auth_token', 'user_profile']).catch(() => {});
    setCurrentPage('login');
  };

  const isDark = useMemo(() => {
    if (settings.display.theme === 'dark') return true;
    if (settings.display.theme === 'light') return false;
    return Appearance.getColorScheme() === 'dark';
  }, [settings.display.theme]);

  return (
    <AppContext.Provider
      value={{
        isReady,
        isDark,
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
        setUser,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
