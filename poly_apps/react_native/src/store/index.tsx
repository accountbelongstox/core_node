import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Friend, ThemeMode, Language } from '../types';
import { translations } from '../config/translations';

// Mock Data
const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Chen',
  phone: '13800138000',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  signature: 'Stay safe, stay connected.',
  gender: 'male',
  address: 'Beijing, China',
  email: 'alex@example.com',
  idCard: '11010119900101****'
};

const MOCK_FRIENDS: Friend[] = [
  {
    id: 'f1',
    name: 'Sarah',
    phone: '13900000000',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    relation: 'Partner',
    daysConnected: 1314,
    lastActive: 'Just now',
    isMonitored: true,
    location: { lat: 39.9042, lng: 116.4074, address: 'Near Palace Museum' },
    health: { steps: 8432, heartRate: 78, temp: 36.5 },
    device: { network: '5G', unlocks: 42, usageTime: '4h 15m' },
    chat: {
      lastMessage: 'Are you coming home for dinner?',
      unreadCount: 3,
      lastMessageTime: '10:45 AM'
    }
  },
  {
    id: 'f2',
    name: 'Mom',
    phone: '13700000000',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mom',
    relation: 'Parent',
    daysConnected: 520,
    lastActive: '10 min ago',
    isMonitored: false,
    location: { lat: 39.9142, lng: 116.4174, address: 'Home' },
    health: { steps: 1200, heartRate: 82, temp: 36.6 },
    device: { network: 'WiFi', unlocks: 10, usageTime: '1h 00m' },
    chat: {
      lastMessage: 'Remember to wear a jacket.',
      unreadCount: 0,
      lastMessageTime: 'Yesterday'
    }
  }
];

interface AppState {
  user: User | null;
  friends: Friend[];
  theme: ThemeMode;
  language: Language;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (phone: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  updateUser: (data: Partial<User>) => void;
  toggleMonitor: (friendId: string) => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'app_user',
  THEME: 'app_theme',
  LANGUAGE: 'app_lang',
  FRIENDS: 'app_friends',
} as const;

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>(MOCK_FRIENDS);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [language, setLanguageState] = useState<Language>('zh');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial state from AsyncStorage
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const [savedUser, savedTheme, savedLang, savedFriends] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.USER),
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
          AsyncStorage.getItem(STORAGE_KEYS.FRIENDS),
        ]);

        if (savedUser) {
          setUserState(JSON.parse(savedUser));
        }
        if (savedTheme) {
          setTheme(savedTheme as ThemeMode);
        }
        if (savedLang) {
          setLanguageState(savedLang as Language);
        }
        if (savedFriends) {
          setFriends(JSON.parse(savedFriends));
        }
      } catch (error) {
        console.error('Error loading initial state:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadInitialState();
  }, []);

  // Persistence Effects with re-render trigger
  useEffect(() => {
    if (isInitialized) {
      const saveUser = async () => {
        try {
          if (user) {
            await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.USER);
          }
        } catch (error) {
          console.error('Error saving user:', error);
        }
      };
      saveUser();
    }
  }, [user, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      const saveTheme = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
        } catch (error) {
          console.error('Error saving theme:', error);
        }
      };
      saveTheme();
    }
  }, [theme, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      const saveLanguage = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
        } catch (error) {
          console.error('Error saving language:', error);
        }
      };
      saveLanguage();
    }
  }, [language, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      const saveFriends = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends));
        } catch (error) {
          console.error('Error saving friends:', error);
        }
      };
      saveFriends();
    }
  }, [friends, isInitialized]);

  // Actions
  const login = useCallback((phone: string) => {
    // Simulating API call
    const newUser = { ...MOCK_USER, phone };
    setUserState(newUser);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: string) => {
    return translations[language][key] || key;
  }, [language]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUserState(prev => prev ? { ...prev, ...data } : null);
  }, []);

  const toggleMonitor = useCallback((friendId: string) => {
    setFriends(prev => prev.map(f => 
      f.id === friendId ? { ...f, isMonitored: !f.isMonitored } : f
    ));
  }, []);

  return (
    <StoreContext.Provider value={{
      user,
      friends,
      theme,
      language,
      isAuthenticated: !!user,
      isInitialized,
      login,
      logout,
      toggleTheme,
      setLanguage,
      t,
      updateUser,
      toggleMonitor
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};

