export type Language = 'en' | 'zh';
export type ThemeMode = 'light' | 'dark';

export interface User {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  signature?: string;
  gender?: 'male' | 'female';
  address?: string;
  birthday?: string;
  email?: string;
  idCard?: string; // For real-name auth
}

export interface Friend extends User {
  relation: string; // 'Partner', 'Child', 'Parent'
  daysConnected: number;
  lastActive: string;
  isMonitored: boolean;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  health?: {
    steps: number;
    heartRate: number;
    temp: number;
  };
  device?: {
    network: 'WiFi' | '4G' | '5G';
    unlocks: number;
    usageTime: string; // "5h 20m"
  };
}

export interface HistoryPoint {
  time: string;
  location: string;
  duration: string;
  lat: number;
  lng: number;
}

export interface ZodiacSign {
  name: string;
  symbol: string;
  dateRange: string;
  element: string;
}

export interface FortuneResponse {
  horoscope: string;
  luckyColor: string;
  luckyNumber: string;
  mood: string;
}