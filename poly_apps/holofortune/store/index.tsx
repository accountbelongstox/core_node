import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Friend, ThemeMode, Language } from '../types';
import { translations } from '../translations';

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
  login: (phone: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  updateUser: (data: Partial<User>) => void;
  toggleMonitor: (friendId: string) => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

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
        const [savedUser, savedTheme, savedLang] = await Promise.all([
          AsyncStorage.getItem('app_user'),
          AsyncStorage.getItem('app_theme'),
          AsyncStorage.getItem('app_lang'),
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
      } catch (error) {
        console.error('Error loading initial state:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadInitialState();
  }, []);

  // Persistence Effects
  useEffect(() => {
    if (isInitialized) {
      if (user) {
        AsyncStorage.setItem('app_user', JSON.stringify(user));
      } else {
        AsyncStorage.removeItem('app_user');
      }
    }
  }, [user, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem('app_theme', theme);
    }
  }, [theme, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem('app_lang', language);
    }
  }, [language, isInitialized]);

  // Actions
  const login = (phone: string) => {
    // Simulating API call
    const newUser = { ...MOCK_USER, phone };
    setUserState(newUser);
  };

  const logout = () => {
    setUserState(null);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      setUserState({ ...user, ...data });
    }
  };

  const toggleMonitor = (friendId: string) => {
    setFriends(prev => prev.map(f => 
      f.id === friendId ? { ...f, isMonitored: !f.isMonitored } : f
    ));
  };

  return (
    <StoreContext.Provider value={{
      user,
      friends,
      theme,
      language,
      isAuthenticated: !!user,
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