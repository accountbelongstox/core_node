
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

// Customer Service Representative (详细定义在文件后面)

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

// 推广轨迹记录（推广记录的细节）
export interface PromotionTrack {
  id: string;
  recordId: string; // 所属推广记录ID
  appId: string; // APP ID
  appName: string; // APP名称
  location: string; // 推广地点
  action: string; // 推广动作，如"贴小广告"
  timestamp: string; // 时间戳，格式：YYYY-MM-DD HH:mm:ss
  isValid: boolean; // 是否有效
  notes?: string; // 备注
  createdAt: string; // 创建时间
}

// 推广记录
export interface PromotionRecord {
  id: string;
  appId: string; // APP ID
  appName: string; // APP名称
  promoterId: string; // 推广人员ID
  promoterName: string; // 推广人员姓名
  startTime: string; // 开始时间，格式：YYYY-MM-DD HH:mm:ss
  endTime: string; // 结束时间，格式：YYYY-MM-DD HH:mm:ss
  validCount: number; // 有效值（有效推广次数）
  unitPrice: number; // 单价
  totalPrice: number; // 总价
  deduction: number; // 扣单
  settlement: number; // 结算价
  approverId?: string; // 审批人ID
  approverName?: string; // 审批人姓名
  isSettled: boolean; // 是否结算
  paymentAddress?: string; // 收款信息（加密货币地址）
  videoRecords?: string[]; // 视频记录URL数组
  locationRecords?: LocationRecord[]; // 手机定位记录
  tracks: PromotionTrack[]; // 推广轨迹细节列表
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

// 手机定位记录
export interface LocationRecord {
  id: string;
  latitude: number; // 纬度
  longitude: number; // 经度
  address: string; // 地址
  timestamp: string; // 时间戳
  accuracy?: number; // 精度（米）
}

// 推广人员
export interface Promoter {
  id: string;
  name: string; // 推广人姓名
  photo?: string; // 照片URL
  contact: string; // 联系方式（电话/微信等）
  joinDate: string; // 加盟时间
  region: string; // 负责区域，如"北京大兴"
  totalValidCount: number; // 总有效值
  unitPrice: number; // 单价
  totalPrice: number; // 总价
  totalDeduction: number; // 总扣单
  totalSettlement: number; // 总结算价
  approverId?: string; // 审批人ID
  approverName?: string; // 审批人姓名
  settledAmount: number; // 已结算价格
  unsettledAmount: number; // 未结价格
  paymentAddress?: string; // 收款信息（加密货币地址）
  recordIds: string[]; // 关联的推广记录ID列表
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

// 客服人员（扩展原有接口）
export interface CustomerService extends User {
  role: UserRole.CS;
  status: 'Online' | 'Offline';
  totalEarnings: number;
  assignedAppIds: string[];
  commissionRate: number; // Commission rate percentage
  // 新增字段
  photo?: string; // 照片URL
  contact: string; // 联系方式
  joinDate: string; // 加盟时间
  level: string; // 客服级别，如"初级"、"中级"、"高级"
  nickname?: string; // 昵称，小字开头，如"小雨"
  businessAmount: number; // 业务金额
  commissionAmount: number; // 提成金额
  commissionPercentage: number; // 提成%比
  totalPrice: number; // 总价
  totalDeduction: number; // 总扣单
  totalSettlement: number; // 总结算价
  approverId?: string; // 审批人ID
  approverName?: string; // 审批人姓名
  settledAmount: number; // 已结算价格
  unsettledAmount: number; // 未结价格
  paymentAddress?: string; // 收款信息（加密货币地址）
}

// APP发布记录
export interface AppRelease {
  id: string;
  appId: string;
  appName: string;
  releasedBy: string; // 发布人ID
  releasedByName: string; // 发布人姓名
  releasedAt: string; // 发布时间
  status: 'released' | 'promoting' | 'completed'; // 状态
  downloadUrl: string; // APP下载地址
  encryptedString: string; // 加密字符串，用于生成访问URL
  secondaryUrl?: string; // 第二个访问URL（绝对URL）
  coverImage?: string; // APP封面图片URL
  description?: string; // APP描述
}
