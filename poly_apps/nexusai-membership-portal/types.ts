
export enum MembershipTier {
  FREE = 'Free',
  PRO = 'Pro',
  ULTIMATE = 'Ultimate'
}

export interface UserStats {
  tokensUsed: number;
  tokenLimit: number;
  imagesGenerated: number;
  imageLimit: number;
  computeHours: number;
  computeLimit: number;
}

export interface UsageHistory {
  date: string;
  tokens: number;
  images: number;
}

export interface PlanFeature {
  name: string;
  included: boolean;
  value?: string;
}

export interface Plan {
  id: MembershipTier;
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  isPopular?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  status: 'active' | 'revoked';
}

export interface UptimePoint {
  status: 'up' | 'partial' | 'down';
}

export interface SystemStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  latency: string;
  uptime: number;
  history: UptimePoint[];
}

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'zh';
