
export interface NavItem {
  label: string;
  path: string;
}

export interface FeatureProps {
  title: string;
  description: string;
  image: string;
  align?: 'left' | 'right';
}

export enum Theme {
  DEFAULT = 'default',
  TACTICAL = 'tactical',
  LUXURY = 'luxury',
  NATURE = 'nature',
  INDUSTRIAL = 'industrial',
  SECURITY = 'security'
}

import { Language } from './i18n/types';
export type { Language };

import { User } from './data/models/user';

export interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
  t: (key: string) => string;
  openLogin: () => void;
  openRegister: () => void;
  isLoggedIn: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isCorporateDrawerOpen: boolean;
  setCorporateDrawerOpen: (isOpen: boolean) => void;
  isHotelDrawerOpen: boolean;
  setHotelDrawerOpen: (isOpen: boolean) => void;
  isShootingDrawerOpen: boolean;
  setShootingDrawerOpen: (isOpen: boolean) => void;
  isGolfDrawerOpen: boolean;
  setGolfDrawerOpen: (isOpen: boolean) => void;
}
    