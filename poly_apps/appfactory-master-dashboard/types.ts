
// User Roles
export enum UserRole {
  ADMIN = 'admin',
  CS = 'cs',
  TECH = 'tech',
}

// APP Status
export enum AppStatus {
  LIVE = 'Live',
  PENDING = 'Pending',
  FAILED = 'Failed',
  IDLE = 'Idle',
  GENERATING = 'Generating',
}

// APP Category
export enum AppCategory {
  FINANCE = 'Finance',
  EDUCATION = 'Education',
  HEALTH = 'Health',
  ENTERTAINMENT = 'Entertainment',
  PRODUCTIVITY = 'Productivity',
  SOCIAL = 'Social',
  SHOPPING = 'Shopping',
  TRAVEL = 'Travel',
}

// User Interface (extends UserInfo from storageService)
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
}

// Customer Service Representative
export interface CustomerService extends User {
  role: UserRole.CS;
  status: 'Online' | 'Offline';
  totalEarnings: number;
  assignedAppIds: string[];
  commissionRate: number; // Commission rate percentage
}

// Technical Team Member
export interface TechMember extends User {
  role: UserRole.TECH;
  specialization: string; // e.g., "Frontend", "Backend", "DevOps"
  appsGenerated: number;
  status: 'Available' | 'Busy' | 'Offline';
}

// APP Instance
export interface AppInstance {
  id: string;
  name: string;
  status: AppStatus;
  category: AppCategory;
  visits: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
  description: string;
  assignedCSIds: string[];
  assignedTechId?: string;
  features: string[];
  targetAudience: string;
  launchDate?: string;
  monthlyRevenue: number;
  dailyActiveUsers: number;
  rating?: number;
}

// CS-APP Revenue Tracking (many-to-many)
export interface CSAppRevenue {
  id: string;
  csId: string;
  appId: string;
  revenue: number;
  commission: number;
  promotions: number; // Number of successful promotions
  lastUpdated: string;
}

// Daily Statistics
export interface DailyStat {
  date: string;
  visits: number;
  revenue: number;
  newApps: number;
  activeUsers: number;
}

// APP Generation Request
export interface AppGenerationRequest {
  id: string;
  name: string;
  category: AppCategory;
  description: string;
  features: string[];
  targetAudience: string;
  requestedBy: string; // User ID
  requestedAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTechId?: string;
  estimatedCompletionDate?: string;
  completionDate?: string;
}

// Revenue Summary
export interface RevenueSummary {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  growth: number; // Percentage growth
}

// System Statistics
export interface SystemStats {
  totalApps: number;
  liveApps: number;
  totalCS: number;
  totalTech: number;
  totalRevenue: number;
  totalVisits: number;
  avgRating: number;
}
