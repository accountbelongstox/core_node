import type {
  CodemartUserRole,
  ProjectStatus,
  PaymentStatus,
  CreditCategory
} from '../constants_app_codemart/codemart-constants';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  role: CodemartUserRole;
  isVerified: boolean;
  depositAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Developer extends User {
  role: 'developer' | 'architect';
  skills: string[];
  completedProjects: number;
  averageRating: number;
  totalEarnings: number;
  bio?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface Client extends User {
  role: 'client';
  companyName?: string;
  contactPhone?: string;
  totalSpent: number;
  activeProjects: number;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  shortDescription: string;
  detailedDescription: string;
  status: ProjectStatus;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  estimatedDuration: number;
  deadline?: string;
  attachments: Attachment[];
  referenceUrls: string[];
  referenceCode?: string;
  techStack: TechStack;
  teamComposition: TeamMember[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'document' | 'image' | 'data';
  size: number;
  uploadedAt: string;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
}

export interface TeamMember {
  userId: string;
  role: 'architect' | 'developer' | 'reviewer';
  assignedAt: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  skillTags: string[];
  estimatedHours: number;
  status: 'open' | 'assigned' | 'in_progress' | 'in_review' | 'completed' | 'rejected';
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
}

export interface CodeReview {
  id: string;
  taskId: string;
  reviewerId: string;
  developerId: string;
  codeQuality: number;
  readability: number;
  efficiency: number;
  standards: number;
  overallScore: number;
  comments: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  projectId: string;
  fromUserId: string;
  toUserId?: string;
  amount: number;
  currency: string;
  type: 'deposit' | 'milestone' | 'bonus' | 'final' | 'refund';
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  processedAt?: string;
  note?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'paid';
  completedAt?: string;
  paidAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'project' | 'task' | 'payment' | 'review' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface AIAnalysis {
  projectId: string;
  requirements: {
    keywords: string[];
    complexity: 'low' | 'medium' | 'high' | 'very_high';
    category: string[];
  };
  recommendations: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    tools: string[];
  };
  teamSuggestion: {
    architects: number;
    seniorDevelopers: number;
    juniorDevelopers: number;
    reviewers: number;
  };
  estimatedCost: {
    min: number;
    max: number;
    currency: string;
  };
  estimatedDuration: number;
  generatedAt: string;
}

export interface Statistics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalDevelopers: number;
  totalClients: number;
  totalRevenue: number;
  averageProjectValue: number;
  successRate: number;
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  articles: HelpArticle[];
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  tags: string[];
  views: number;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFlowStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

export interface Testimonial {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
  rating: number;
  comment: string;
  projectName?: string;
  createdAt: string;
}

export interface ProjectCategory {
  id: string;
  name: string;
  icon: string;
  projectCount: number;
  description: string;
}
