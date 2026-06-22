/**
 * Model Data Centralized Service
 * Unified management of all data models and state
 * 
 * Mock data (from constants.ts) should NEVER be cached
 * Only user-generated data should be cached
 */
import { storageService } from './storageService';
import {
  AppInstance,
  CustomerService,
  TechMember,
  PromotionTrack,
  PromotionRecord,
  Promoter,
  AppRelease,
  DailyStat,
  CSAppRevenue,
  Notification,
  Bug,
  Build,
  ChatSession,
  ChatMessage,
  ScriptTemplate,
  PaymentVerificationRequest,
  SystemStats,
  RevenueSummary,
  AppGenerationRequest,
  CSDashboardData,
} from '../types';
import { 
  MOCK_CS, 
  MOCK_TECH, 
  MOCK_APPS, 
  MOCK_PROMOTERS, 
  MOCK_PROMOTION_TRACKS, 
  MOCK_APP_RELEASES, 
  MOCK_PROMOTION_RECORDS, 
  MOCK_APP_REQUESTS, 
  MOCK_CS_APP_REVENUE, 
  MOCK_DAILY_STATS, 
  MOCK_NOTIFICATIONS, 
  MOCK_BUGS, 
  MOCK_BUILDS, 
  MOCK_CHAT_SESSIONS, 
  MOCK_CHAT_MESSAGES, 
  MOCK_SCRIPT_TEMPLATES, 
  MOCK_PAYMENT_VERIFICATION_REQUESTS 
} from '../constants';

// Model data keys
export const MODEL_KEYS = {
  APPS: 'model_apps',
  CS_TEAM: 'model_cs_team',
  TECH_TEAM: 'model_tech_team',
  REVENUE: 'model_revenue',
  STATISTICS: 'model_statistics',
  PROMOTION_TRACKS: 'model_promotion_tracks',
  APP_RELEASES: 'model_app_releases',
  PROMOTERS: 'model_promoters',
  PROMOTION_RECORDS: 'model_promotion_records',
  APP_REQUESTS: 'model_app_requests',
  CS_APP_REVENUE: 'model_cs_app_revenue',
  DAILY_STATS: 'model_daily_stats',
  NOTIFICATIONS: 'model_notifications',
  BUGS: 'model_bugs',
  BUILDS: 'model_builds',
  CHAT_SESSIONS: 'model_chat_sessions',
  CHAT_MESSAGES: 'model_chat_messages',
  SCRIPT_TEMPLATES: 'model_script_templates',
  PAYMENT_VERIFICATION_REQUESTS: 'model_payment_verification_requests',
} as const;

/**
 * Mock data keys that should NEVER be cached
 * These always return fresh data from constants.ts
 */
const MOCK_DATA_KEYS = new Set<string>([
  MODEL_KEYS.APPS,
  MODEL_KEYS.CS_TEAM,
  MODEL_KEYS.TECH_TEAM,
  MODEL_KEYS.PROMOTION_TRACKS,
  MODEL_KEYS.APP_RELEASES,
  MODEL_KEYS.PROMOTERS,
  MODEL_KEYS.PROMOTION_RECORDS,
  MODEL_KEYS.APP_REQUESTS,
  MODEL_KEYS.CS_APP_REVENUE,
  MODEL_KEYS.DAILY_STATS,
  MODEL_KEYS.NOTIFICATIONS,
  MODEL_KEYS.BUGS,
  MODEL_KEYS.BUILDS,
  MODEL_KEYS.CHAT_SESSIONS,
  MODEL_KEYS.CHAT_MESSAGES,
  MODEL_KEYS.SCRIPT_TEMPLATES,
  MODEL_KEYS.PAYMENT_VERIFICATION_REQUESTS,
]);

/**
 * Model Data Centralized Service Class
 */
class ModelService {
  /**
   * Get model data from cache
   * Returns defaultValue if not found
   */
  private getCachedModel<T>(key: string, defaultValue: T): T {
    return storageService.get<T>(key, defaultValue) ?? defaultValue;
  }

  /**
   * Set model data to cache
   */
  private setCachedModel<T>(key: string, value: T): void {
    storageService.set(key, value);
  }

  /**
   * Remove model data from cache
   */
  private removeCachedModel(key: string): void {
    storageService.remove(key);
  }

  /**
   * Check if a key is mock data (should not be cached)
   */
  private isMockData(key: string): boolean {
    return MOCK_DATA_KEYS.has(key);
  }

  /**
   * Get model data
   * Mock data always returns fresh data from constants.ts
   * User-generated data returns cached data or defaultValue
   */
  getModel<T>(key: string, defaultValue: T): T {
    // Mock data should never be cached - always return defaultValue (from constants)
    if (this.isMockData(key)) {
      return defaultValue;
    }
    // User-generated data can be cached
    return this.getCachedModel(key, defaultValue);
  }

  /**
   * Set model data
   * Mock data cannot be set (will be ignored)
   * Only user-generated data can be cached
   */
  setModel<T>(key: string, value: T): void {
    // Mock data should never be cached - ignore set operations
    if (this.isMockData(key)) {
      console.warn(`[ModelService] Attempted to cache mock data for key: ${key}. This operation is ignored.`);
      return;
    }
    // Only cache user-generated data
    this.setCachedModel(key, value);
  }

  /**
   * Remove model data
   */
  removeModel(key: string): void {
    this.removeCachedModel(key);
  }

  /**
   * Clear all cached model data
   * Note: Mock data is never cached, so this only clears user-generated data
   */
  clearAllModels(): void {
    Object.values(MODEL_KEYS).forEach((key) => {
      // Only clear user-generated data (mock data is never cached)
      if (!this.isMockData(key)) {
        this.removeModel(key);
      }
    });
  }

  /**
   * Get apps list
   * Mock data - always returns fresh data from constants.ts
   */
  getApps(): AppInstance[] {
    return MOCK_APPS;
  }

  /**
   * Set apps list
   * Mock data cannot be cached - this operation is ignored
   * Use addApp() or updateApp() to add/modify user-generated apps
   */
  setApps(apps: AppInstance[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setApps() called - Mock data cannot be cached. Use addApp() or updateApp() instead.');
  }

  /**
   * Add user-generated app
   */
  addApp(app: AppInstance): AppInstance {
    // User-generated apps should be stored separately
    // For now, this is a no-op since we only support mock apps
    console.warn('[ModelService] addApp() called - User-generated apps not yet supported');
    return app;
  }

  /**
   * Update app
   */
  updateApp(id: string, updates: Partial<AppInstance>): AppInstance | null {
    // User-generated apps should be stored separately
    // For now, this is a no-op since we only support mock apps
    console.warn('[ModelService] updateApp() called - User-generated apps not yet supported');
    return null;
  }

  /**
   * Get customer service team data
   * Mock data - always returns fresh data from constants.ts
   */
  getCSTeam(): CustomerService[] {
    return MOCK_CS;
  }

  /**
   * Get CS by ID with fallback logic
   * Returns first CS if not found (for dashboard compatibility)
   */
  getCSById(csId: string | null | undefined): CustomerService | null {
    const csTeam = this.getCSTeam();
    if (!csId) {
      return csTeam.length > 0 ? csTeam[0] : null;
    }
    const cs = csTeam.find(c => c.id === csId);
    return cs || (csTeam.length > 0 ? csTeam[0] : null);
  }

  /**
   * Get CS dashboard data with all computed fields
   * This centralizes all calculation logic, avoiding redundancy in components
   */
  getCSDashboardData(csId: string | null | undefined): CSDashboardData | null {
    const cs = this.getCSById(csId);
    if (!cs) return null;

    const apps = this.getApps();
    const csAppRevenue = this.getCSAppRevenue();

    // Get assigned apps
    const assignedApps = apps.filter(app => cs.assignedAppIds.includes(app.id));

    // Calculate total revenue from assigned apps
    const totalRevenue = assignedApps.reduce((acc, app) => acc + app.revenue, 0);

    // Get CS revenue records
    const csRevenue = csAppRevenue.filter(r => r.csId === cs.id);

    // Calculate total promotions
    const totalPromotions = csRevenue.reduce((acc, r) => acc + r.promotions, 0);

    // Calculate rank
    const csTeam = this.getCSTeam();
    const sortedCS = [...csTeam].sort((a, b) => b.totalEarnings - a.totalEarnings);
    const rank = sortedCS.findIndex(c => c.id === cs.id) + 1;

    return {
      cs,
      assignedApps,
      totalRevenue,
      totalPromotions,
      csRevenue,
      rank,
      totalCS: csTeam.length,
    };
  }

  /**
   * Set customer service team data
   * Mock data cannot be cached - this operation is ignored
   */
  setCSTeam(team: CustomerService[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setCSTeam() called - Mock data cannot be cached.');
  }

  /**
   * Add customer service member
   */
  addCS(cs: CustomerService): CustomerService {
    // User-generated CS members should be stored separately
    console.warn('[ModelService] addCS() called - User-generated CS members not yet supported');
    return cs;
  }

  /**
   * Update customer service member
   */
  updateCS(id: string, updates: Partial<CustomerService>): CustomerService | null {
    // User-generated CS members should be stored separately
    console.warn('[ModelService] updateCS() called - User-generated CS members not yet supported');
    return null;
  }

  /**
   * Get tech team data
   * Mock data - always returns fresh data from constants.ts
   */
  getTechTeam(): TechMember[] {
    return MOCK_TECH;
  }

  /**
   * Set tech team data
   * Mock data cannot be cached - this operation is ignored
   */
  setTechTeam(team: TechMember[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setTechTeam() called - Mock data cannot be cached.');
  }

  /**
   * Get revenue data
   * User-generated data - can be cached
   */
  getRevenue(): RevenueSummary {
    return this.getModel<RevenueSummary>(MODEL_KEYS.REVENUE, {
      totalRevenue: 0,
      todayRevenue: 0,
      monthRevenue: 0,
      yearRevenue: 0,
      growth: 0,
    });
  }

  /**
   * Set revenue data
   * User-generated data - can be cached
   */
  setRevenue(revenue: RevenueSummary): void {
    this.setModel(MODEL_KEYS.REVENUE, revenue);
  }

  /**
   * Get statistics data
   * User-generated data - can be cached
   */
  getStatistics(): SystemStats {
    return this.getModel<SystemStats>(MODEL_KEYS.STATISTICS, {
      totalApps: 0,
      liveApps: 0,
      totalCS: 0,
      totalTech: 0,
      totalRevenue: 0,
      totalVisits: 0,
      avgRating: 0,
    });
  }

  /**
   * Set statistics data
   * User-generated data - can be cached
   */
  setStatistics(statistics: SystemStats): void {
    this.setModel(MODEL_KEYS.STATISTICS, statistics);
  }

  /**
   * Get promotion tracks data
   * Mock data - always returns fresh data from constants.ts
   */
  getPromotionTracks(): PromotionTrack[] {
    return MOCK_PROMOTION_TRACKS;
  }

  /**
   * Set promotion tracks data
   * Mock data cannot be cached - this operation is ignored
   */
  setPromotionTracks(tracks: PromotionTrack[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setPromotionTracks() called - Mock data cannot be cached.');
  }

  /**
   * Add promotion track
   */
  addPromotionTrack(track: PromotionTrack): PromotionTrack {
    // User-generated tracks should be stored separately
    console.warn('[ModelService] addPromotionTrack() called - User-generated tracks not yet supported');
    return track;
  }

  /**
   * Get app releases
   * Mock data - always returns fresh data from constants.ts
   */
  getAppReleases(): AppRelease[] {
    return MOCK_APP_RELEASES;
  }

  /**
   * Set app releases
   * Mock data cannot be cached - this operation is ignored
   */
  setAppReleases(releases: AppRelease[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setAppReleases() called - Mock data cannot be cached.');
  }

  /**
   * Add app release
   */
  addAppRelease(release: AppRelease): AppRelease {
    // User-generated releases should be stored separately
    console.warn('[ModelService] addAppRelease() called - User-generated releases not yet supported');
    return release;
  }

  /**
   * Get promoters list
   * Mock data - always returns fresh data from constants.ts
   */
  getPromoters(): Promoter[] {
    return MOCK_PROMOTERS;
  }

  /**
   * Set promoters list
   * Mock data cannot be cached - this operation is ignored
   */
  setPromoters(promoters: Promoter[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setPromoters() called - Mock data cannot be cached.');
  }

  /**
   * Add promoter
   */
  addPromoter(promoter: Promoter): Promoter {
    // User-generated promoters should be stored separately
    console.warn('[ModelService] addPromoter() called - User-generated promoters not yet supported');
    return promoter;
  }

  /**
   * Update promoter
   */
  updatePromoter(id: string, updates: Partial<Promoter>): Promoter | null {
    // User-generated promoters should be stored separately
    console.warn('[ModelService] updatePromoter() called - User-generated promoters not yet supported');
    return null;
  }

  /**
   * Get promotion records list
   * Mock data - always returns fresh data from constants.ts
   */
  getPromotionRecords(): PromotionRecord[] {
    return MOCK_PROMOTION_RECORDS;
  }

  /**
   * Set promotion records list
   * Mock data cannot be cached - this operation is ignored
   */
  setPromotionRecords(records: PromotionRecord[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setPromotionRecords() called - Mock data cannot be cached.');
  }

  /**
   * Add promotion record
   */
  addPromotionRecord(record: PromotionRecord): PromotionRecord {
    // User-generated records should be stored separately
    console.warn('[ModelService] addPromotionRecord() called - User-generated records not yet supported');
    return record;
  }

  /**
   * Get app generation requests
   * Mock data - always returns fresh data from constants.ts
   */
  getAppRequests(): AppGenerationRequest[] {
    return MOCK_APP_REQUESTS;
  }

  /**
   * Set app generation requests
   * Mock data cannot be cached - this operation is ignored
   */
  setAppRequests(requests: AppGenerationRequest[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setAppRequests() called - Mock data cannot be cached.');
  }

  /**
   * Get CS app revenue
   * Mock data - always returns fresh data from constants.ts
   */
  getCSAppRevenue(): CSAppRevenue[] {
    return MOCK_CS_APP_REVENUE;
  }

  /**
   * Set CS app revenue
   * Mock data cannot be cached - this operation is ignored
   */
  setCSAppRevenue(revenue: CSAppRevenue[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setCSAppRevenue() called - Mock data cannot be cached.');
  }

  /**
   * Get daily stats
   * Mock data - always returns fresh data from constants.ts
   */
  getDailyStats(): DailyStat[] {
    return MOCK_DAILY_STATS;
  }

  /**
   * Set daily stats
   * Mock data cannot be cached - this operation is ignored
   */
  setDailyStats(stats: DailyStat[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setDailyStats() called - Mock data cannot be cached.');
  }

  /**
   * Get notifications
   * Mock data - always returns fresh data from constants.ts
   */
  getNotifications(): Notification[] {
    return MOCK_NOTIFICATIONS;
  }

  /**
   * Set notifications
   * Mock data cannot be cached - this operation is ignored
   */
  setNotifications(notifications: Notification[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setNotifications() called - Mock data cannot be cached.');
  }

  /**
   * Add notification
   */
  addNotification(notification: Notification): Notification {
    // User-generated notifications should be stored separately
    console.warn('[ModelService] addNotification() called - User-generated notifications not yet supported');
    return notification;
  }

  /**
   * Get bugs
   * Mock data - always returns fresh data from constants.ts
   */
  getBugs(): Bug[] {
    return MOCK_BUGS;
  }

  /**
   * Set bugs
   * Mock data cannot be cached - this operation is ignored
   */
  setBugs(bugs: Bug[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setBugs() called - Mock data cannot be cached.');
  }

  /**
   * Add bug
   */
  addBug(bug: Bug): Bug {
    // User-generated bugs should be stored separately
    console.warn('[ModelService] addBug() called - User-generated bugs not yet supported');
    return bug;
  }

  /**
   * Get builds list
   * Mock data - always returns fresh data from constants.ts
   */
  getBuilds(): Build[] {
    return MOCK_BUILDS;
  }

  /**
   * Set builds list
   * Mock data cannot be cached - this operation is ignored
   */
  setBuilds(builds: Build[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setBuilds() called - Mock data cannot be cached.');
  }

  /**
   * Add build
   */
  addBuild(build: Build): Build {
    // User-generated builds should be stored separately
    console.warn('[ModelService] addBuild() called - User-generated builds not yet supported');
    return build;
  }

  /**
   * Get chat sessions
   * Mock data - always returns fresh data from constants.ts
   */
  getChatSessions(): ChatSession[] {
    return MOCK_CHAT_SESSIONS;
  }

  /**
   * Set chat sessions
   * Mock data cannot be cached - this operation is ignored
   */
  setChatSessions(sessions: ChatSession[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setChatSessions() called - Mock data cannot be cached.');
  }

  /**
   * Add chat session
   */
  addChatSession(session: ChatSession): ChatSession {
    // User-generated sessions should be stored separately
    console.warn('[ModelService] addChatSession() called - User-generated sessions not yet supported');
    return session;
  }

  /**
   * Update chat session
   */
  updateChatSession(id: string, updates: Partial<ChatSession>): ChatSession | null {
    // User-generated sessions should be stored separately
    console.warn('[ModelService] updateChatSession() called - User-generated sessions not yet supported');
    return null;
  }

  /**
   * Get chat messages
   * Mock data - always returns fresh data from constants.ts
   */
  getChatMessages(): ChatMessage[] {
    return MOCK_CHAT_MESSAGES;
  }

  /**
   * Set chat messages
   * Mock data cannot be cached - this operation is ignored
   */
  setChatMessages(messages: ChatMessage[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setChatMessages() called - Mock data cannot be cached.');
  }

  /**
   * Add chat message
   */
  addChatMessage(message: ChatMessage): ChatMessage {
    // User-generated messages should be stored separately
    console.warn('[ModelService] addChatMessage() called - User-generated messages not yet supported');
    return message;
  }

  /**
   * Get messages by session ID
   * Filters messages from all chat messages by sessionId
   */
  getMessagesBySessionId(sessionId: string): ChatMessage[] {
    const allMessages = this.getChatMessages();
    return allMessages.filter(msg => msg.sessionId === sessionId);
  }

  /**
   * Mark all messages in a session as read
   */
  markSessionMessagesAsRead(sessionId: string): void {
    const allMessages = this.getChatMessages();
    const sessionMessages = allMessages.filter(msg => msg.sessionId === sessionId && !msg.isRead);
    
    if (sessionMessages.length > 0) {
      // Update messages to mark as read
      // Since mock data cannot be cached, we'll need to handle this differently
      // For now, this is a no-op for mock data, but the structure is ready for user-generated messages
      console.warn('[ModelService] markSessionMessagesAsRead() called - User-generated messages not yet supported');
    }
  }

  /**
   * Get script templates
   * Mock data - always returns fresh data from constants.ts
   * Usage counts are merged from localStorage
   */
  getScriptTemplates(): ScriptTemplate[] {
    return MOCK_SCRIPT_TEMPLATES.map(template => {
      // Get stored usage count for this template
      const usageKey = `script_template_usage_${template.id}`;
      const storedUsage = storageService.get<number>(usageKey, 0);
      
      return {
        ...template,
        usageCount: template.usageCount + storedUsage
      };
    });
  }

  /**
   * Set script templates
   * Mock data cannot be cached - this operation is ignored
   */
  setScriptTemplates(templates: ScriptTemplate[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setScriptTemplates() called - Mock data cannot be cached.');
  }

  /**
   * Add script template
   */
  addScriptTemplate(template: ScriptTemplate): ScriptTemplate {
    // User-generated templates should be stored separately
    console.warn('[ModelService] addScriptTemplate() called - User-generated templates not yet supported');
    return template;
  }

  /**
   * Update script template
   */
  updateScriptTemplate(id: string, updates: Partial<ScriptTemplate>): ScriptTemplate | null {
    // User-generated templates should be stored separately
    console.warn('[ModelService] updateScriptTemplate() called - User-generated templates not yet supported');
    return null;
  }

  /**
   * Increment script template usage count
   * Stores usage count in localStorage (separate from mock data)
   */
  incrementTemplateUsage(id: string): void {
    try {
      const usageKey = `script_template_usage_${id}`;
      const currentCount = storageService.get<number>(usageKey, 0);
      storageService.set(usageKey, currentCount + 1);
    } catch (error) {
      console.warn('[ModelService] Failed to increment template usage:', error);
    }
  }

  /**
   * Get script template with usage count
   * Combines mock data with stored usage counts
   */
  getScriptTemplateWithUsage(id: string): ScriptTemplate | null {
    const templates = this.getScriptTemplates();
    const template = templates.find(t => t.id === id);
    if (!template) return null;
    
    // Get stored usage count
    const usageKey = `script_template_usage_${id}`;
    const storedUsage = storageService.get<number>(usageKey, 0);
    
    return {
      ...template,
      usageCount: template.usageCount + storedUsage
    };
  }

  /**
   * Get payment verification requests
   * Mock data - always returns fresh data from constants.ts
   */
  getPaymentVerificationRequests(): PaymentVerificationRequest[] {
    return MOCK_PAYMENT_VERIFICATION_REQUESTS;
  }

  /**
   * Set payment verification requests
   * Mock data cannot be cached - this operation is ignored
   */
  setPaymentVerificationRequests(requests: PaymentVerificationRequest[]): void {
    // Mock data should never be cached
    console.warn('[ModelService] setPaymentVerificationRequests() called - Mock data cannot be cached.');
  }

  /**
   * Add payment verification request
   */
  addPaymentVerificationRequest(request: PaymentVerificationRequest): PaymentVerificationRequest {
    // User-generated requests should be stored separately
    console.warn('[ModelService] addPaymentVerificationRequest() called - User-generated requests not yet supported');
    return request;
  }

  /**
   * Update payment verification request
   */
  updatePaymentVerificationRequest(id: string, updates: Partial<PaymentVerificationRequest>): PaymentVerificationRequest | null {
    // User-generated requests should be stored separately
    console.warn('[ModelService] updatePaymentVerificationRequest() called - User-generated requests not yet supported');
    return null;
  }
}

// Export singleton
export const modelService = new ModelService();
