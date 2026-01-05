
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

// Customer Service Representative (detailed definition later in file)

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
  icon?: string; // Encrypted icon filename (e.g., 'app_icon1.en.png')
  splash?: string; // Encrypted splash filename (e.g., 'app_splash1.en.png')
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

// Promotion track record (details of promotion record)
export interface PromotionTrack {
  id: string;
  recordId: string; // Associated promotion record ID
  appId: string; // APP ID
  appName: string; // APP name
  location: string; // Promotion location
  action: string; // Promotion action, e.g. "Post flyer"
  timestamp: string; // Timestamp, format: YYYY-MM-DD HH:mm:ss
  isValid: boolean; // Whether valid
  notes?: string; // Notes
  createdAt: string; // Creation time
}

// Promotion record
export interface PromotionRecord {
  id: string;
  appId: string; // APP ID
  appName: string; // APP name
  promoterId: string; // Promoter ID
  promoterName: string; // Promoter name
  startTime: string; // Start time, format: YYYY-MM-DD HH:mm:ss
  endTime: string; // End time, format: YYYY-MM-DD HH:mm:ss
  validCount: number; // Valid count (number of valid promotions)
  unitPrice: number; // Unit price
  totalPrice: number; // Total price
  deduction: number; // Deduction
  settlement: number; // Settlement price
  approverId?: string; // Approver ID
  approverName?: string; // Approver name
  isSettled: boolean; // Whether settled
  paymentAddress?: string; // Payment information (cryptocurrency address)
  videoRecords?: string[]; // Video record URL array
  locationRecords?: LocationRecord[]; // Mobile location records
  tracks: PromotionTrack[]; // Promotion track details list
  createdAt: string; // Creation time
  updatedAt: string; // Update time
}

// Mobile location record
export interface LocationRecord {
  id: string;
  latitude: number; // Latitude
  longitude: number; // Longitude
  address: string; // Address
  timestamp: string; // Timestamp
  accuracy?: number; // Accuracy (meters)
}

// Promoter
export interface Promoter {
  id: string;
  name: string; // Promoter name
  photo?: string; // Photo URL
  contact: string; // Contact information (phone/WeChat etc.)
  joinDate: string; // Join date
  region: string; // Responsible region, e.g. "Beijing Daxing"
  totalValidCount: number; // Total valid count
  unitPrice: number; // Unit price
  totalPrice: number; // Total price
  totalDeduction: number; // Total deduction
  totalSettlement: number; // Total settlement price
  approverId?: string; // Approver ID
  approverName?: string; // Approver name
  settledAmount: number; // Settled amount
  unsettledAmount: number; // Unsettled amount
  paymentAddress?: string; // Payment information (cryptocurrency address)
  recordIds: string[]; // Associated promotion record ID list
  createdAt: string; // Creation time
  updatedAt: string; // Update time
}

// Customer Service Representative (extends existing interface)
export interface CustomerService extends User {
  role: UserRole.CS;
  status: 'Online' | 'Offline';
  totalEarnings: number;
  assignedAppIds: string[];
  commissionRate: number; // Commission rate percentage
  // New fields
  photo?: string; // Photo URL
  contact: string; // Contact information
  joinDate: string; // Join date
  level: string; // CS level, e.g. "Junior", "Intermediate", "Senior"
  nickname?: string; // Nickname, lowercase start, e.g. "xiaoyu"
  businessAmount: number; // Business amount
  commissionAmount: number; // Commission amount
  commissionPercentage: number; // Commission percentage
  totalPrice: number; // Total price
  totalDeduction: number; // Total deduction
  totalSettlement: number; // Total settlement price
  approverId?: string; // Approver ID
  approverName?: string; // Approver name
  settledAmount: number; // Settled amount
  unsettledAmount: number; // Unsettled amount
  paymentAddress?: string; // Payment information (cryptocurrency address)
}

// Extended CS data with computed fields for dashboard
// This avoids redundant calculations in components
export interface CSDashboardData {
  cs: CustomerService;
  assignedApps: AppInstance[];
  totalRevenue: number;
  totalPromotions: number;
  csRevenue: CSAppRevenue[];
  rank?: number; // Ranking among all CS members
  totalCS?: number; // Total number of CS members
}

// APP release record
export interface AppRelease {
  id: string;
  appId: string;
  appName: string;
  releasedBy: string; // Release person ID
  releasedByName: string; // Release person name
  releasedAt: string; // Release time
  status: 'released' | 'promoting' | 'completed'; // Status
  downloadUrl: string; // APP download URL
  encryptedString: string; // Encrypted string, used to generate access URL
  secondaryUrl?: string; // Secondary access URL (absolute URL)
  coverImage?: string; // APP cover image URL
  description?: string; // APP description
}

// Notification
export interface Notification {
  id: string | number;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  time: string;
  unread: boolean;
}

// Bug
export interface Bug {
  id: string;
  app: string;
  issue: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'In Progress' | 'Pending' | 'Closed';
  reporter: string;
}

// Build
export interface Build {
  id: string;
  app: string;
  status: 'Success' | 'Failed' | 'In Progress';
  duration: string;
  timestamp: string;
  version: string;
  appId?: string; // Link to AppInstance
}

// Chat Message
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'cs'; // customer or customer service
  content: string;
  timestamp: string;
  isRead: boolean;
  createdAt: string;
}

// Chat Session
export interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  csId?: string; // Assigned CS ID
  csName?: string; // Assigned CS Name
  appId?: string; // Associated APP ID
  appName?: string; // Associated APP Name (for quick access)
  status: 'active' | 'waiting' | 'closed';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

// Script Template
export interface ScriptTemplate {
  id: string;
  title: string;
  content: string;
  category: string; // e.g., 'greeting', 'product_info', 'pricing', 'closing'
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// Payment Verification Request
export interface PaymentVerificationRequest {
  id: string;
  sessionId?: string; // Associated chat session ID
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  appId?: string; // Associated APP ID
  appName?: string; // Associated APP Name
  amount: number; // Payment amount
  username?: string; // Customer username for verification
  screenshot?: string; // Screenshot URL
  status: 'pending' | 'verified' | 'rejected' | 'rejected_no_payment';
  reply?: string; // Admin reply message
  repliedBy?: string; // Admin ID who replied
  repliedByName?: string; // Admin name who replied
  repliedAt?: string; // Reply timestamp
  createdAt: string;
  updatedAt: string;
}

// Avatar Provider
export interface AvatarProvider {
  short_code: string;
  name: string;
  max_size: number;
  supports_size: boolean;
  deterministic: boolean;
}

// Avatar Providers List Response
export interface AvatarProvidersListResponse {
  success: boolean;
  providers: AvatarProvider[];
  default: string;
}

// Avatar Cache Stats Response
export interface AvatarCacheStatsResponse {
  cache_dir: string;
  total_files: number;
  total_size: number;
  total_size_mb: number;
}

// Avatar Cache Clear Response
export interface AvatarCacheClearResponse {
  success: boolean;
  message?: string;
  deleted_count?: number;
}
