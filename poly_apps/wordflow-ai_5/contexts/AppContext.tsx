import React, { createContext, useState, useEffect } from 'react';
import { User, AppSettings, DEFAULT_SETTINGS, PlaylistSettings, DEFAULT_PLAYLIST_SETTINGS } from '../types';
import { api } from '../services/api';
import { I18N_DICT } from '../services/mockData';

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
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playlistSettings, setPlaylistSettings] = useState<PlaylistSettings>(DEFAULT_PLAYLIST_SETTINGS);
  const [activeGroupId, setActiveGroupId] = useState<string>('g1'); // Default to first group
  const [currentPage, setCurrentPage] = useState('login');
  const [currentParams, setCurrentParams] = useState<any>({});

  useEffect(() => {
    // Theme System
    const theme = settings.display.theme;
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.display.theme]);

  // Initial Auth Check
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
       api.setToken(token);
       api.getUserProfile()
          .then(u => {
            setUser(u);
            setCurrentPage('home');
          })
          .catch(() => setCurrentPage('login'));
    }
    
    // Load Playlist Settings
    const savedPlaylist = localStorage.getItem('playlist_settings');
    if (savedPlaylist) {
        try {
            setPlaylistSettings({ ...DEFAULT_PLAYLIST_SETTINGS, ...JSON.parse(savedPlaylist) });
        } catch(e) {}
    }

    // Load Active Group
    const savedGroup = localStorage.getItem('active_group_id');
    if (savedGroup) setActiveGroupId(savedGroup);
  }, []);

  const navigate = (page: string, params?: any) => {
    setCurrentParams(params || {});
    setCurrentPage(page);
    window.scrollTo(0,0);
  };

  const handleSetActiveGroup = (id: string) => {
      setActiveGroupId(id);
      localStorage.setItem('active_group_id', id);
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    const newSettings = { ...settings };
    if (partial.language) newSettings.language = { ...settings.language, ...partial.language };
    if (partial.audio) newSettings.audio = { ...settings.audio, ...partial.audio };
    if (partial.display) newSettings.display = { ...settings.display, ...partial.display };
    if (partial.learning) newSettings.learning = { ...settings.learning, ...partial.learning };
    if (partial.notifications) newSettings.notifications = { ...settings.notifications, ...partial.notifications };
    
    setSettings(newSettings);
    api.syncSettings(newSettings);
  };

  const updatePlaylistSettings = (partial: Partial<PlaylistSettings>) => {
      const newSettings = { ...playlistSettings, ...partial };
      setPlaylistSettings(newSettings);
      localStorage.setItem('playlist_settings', JSON.stringify(newSettings));
  };

  const t = (key: string) => {
    const lang = settings.language.appInterface;
    return I18N_DICT[lang]?.[key] || I18N_DICT['en'][key] || key;
  };

  const login = (u: User) => {
    setUser(u);
    setCurrentPage('home');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    setCurrentPage('login');
  };

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