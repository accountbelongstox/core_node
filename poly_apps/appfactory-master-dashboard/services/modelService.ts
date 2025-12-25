/**
 * Model Data Centralized Service
 * Unified management of all data models and state
 */
import { storageService } from './storageService';

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
} as const;

/**
 * Model Data Centralized Service Class
 */
class ModelService {
  /**
   * Get model data
   */
  getModel<T>(key: string, defaultValue?: T): T | null {
    return storageService.get<T>(key, defaultValue);
  }

  /**
   * Set model data
   */
  setModel<T>(key: string, value: T): void {
    storageService.set(key, value);
  }

  /**
   * Remove model data
   */
  removeModel(key: string): void {
    storageService.remove(key);
  }

  /**
   * Clear all model data
   */
  clearAllModels(): void {
    Object.values(MODEL_KEYS).forEach((key) => {
      this.removeModel(key);
    });
  }

  /**
   * Get apps list
   */
  getApps() {
    return this.getModel(MODEL_KEYS.APPS, []);
  }

  /**
   * Set apps list
   */
  setApps(apps: any[]) {
    this.setModel(MODEL_KEYS.APPS, apps);
  }

  /**
   * Get customer service team data
   */
  getCSTeam() {
    return this.getModel(MODEL_KEYS.CS_TEAM, []);
  }

  /**
   * Set customer service team data
   */
  setCSTeam(team: any[]) {
    this.setModel(MODEL_KEYS.CS_TEAM, team);
  }

  /**
   * Get tech team data
   */
  getTechTeam() {
    return this.getModel(MODEL_KEYS.TECH_TEAM, []);
  }

  /**
   * Set tech team data
   */
  setTechTeam(team: any[]) {
    this.setModel(MODEL_KEYS.TECH_TEAM, team);
  }

  /**
   * Get revenue data
   */
  getRevenue() {
    return this.getModel(MODEL_KEYS.REVENUE, {});
  }

  /**
   * Set revenue data
   */
  setRevenue(revenue: any) {
    this.setModel(MODEL_KEYS.REVENUE, revenue);
  }

  /**
   * Get statistics data
   */
  getStatistics() {
    return this.getModel(MODEL_KEYS.STATISTICS, {});
  }

  /**
   * Set statistics data
   */
  setStatistics(statistics: any) {
    this.setModel(MODEL_KEYS.STATISTICS, statistics);
  }

  /**
   * Get promotion tracks data
   */
  getPromotionTracks() {
    return this.getModel(MODEL_KEYS.PROMOTION_TRACKS, []);
  }

  /**
   * Set promotion tracks data
   */
  setPromotionTracks(tracks: any[]) {
    this.setModel(MODEL_KEYS.PROMOTION_TRACKS, tracks);
  }

  /**
   * Add promotion track
   */
  addPromotionTrack(track: any) {
    const tracks = this.getPromotionTracks() || [];
    tracks.unshift(track); // Add to beginning
    this.setPromotionTracks(tracks);
    return track;
  }

  /**
   * Get app releases
   */
  getAppReleases() {
    return this.getModel(MODEL_KEYS.APP_RELEASES, []);
  }

  /**
   * Set app releases
   */
  setAppReleases(releases: any[]) {
    this.setModel(MODEL_KEYS.APP_RELEASES, releases);
  }

  /**
   * Add app release
   */
  addAppRelease(release: any) {
    const releases = this.getAppReleases() || [];
    releases.unshift(release); // Add to beginning
    this.setAppReleases(releases);
    return release;
  }

  /**
   * Get promoters list
   */
  getPromoters() {
    return this.getModel(MODEL_KEYS.PROMOTERS, []);
  }

  /**
   * Set promoters list
   */
  setPromoters(promoters: any[]) {
    this.setModel(MODEL_KEYS.PROMOTERS, promoters);
  }

  /**
   * Add promoter
   */
  addPromoter(promoter: any) {
    const promoters = this.getPromoters() || [];
    promoters.push(promoter);
    this.setPromoters(promoters);
    return promoter;
  }

  /**
   * Update promoter
   */
  updatePromoter(id: string, updates: any) {
    const promoters = this.getPromoters() || [];
    const index = promoters.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      promoters[index] = { ...promoters[index], ...updates, updatedAt: new Date().toISOString() };
      this.setPromoters(promoters);
      return promoters[index];
    }
    return null;
  }

  /**
   * Get promotion records list
   */
  getPromotionRecords() {
    return this.getModel(MODEL_KEYS.PROMOTION_RECORDS, []);
  }

  /**
   * Set promotion records list
   */
  setPromotionRecords(records: any[]) {
    this.setModel(MODEL_KEYS.PROMOTION_RECORDS, records);
  }

  /**
   * Add promotion record
   */
  addPromotionRecord(record: any) {
    const records = this.getPromotionRecords() || [];
    records.unshift(record); // Add to beginning
    this.setPromotionRecords(records);
    return record;
  }

  /**
   * Update promotion record
   */
  updatePromotionRecord(id: string, updates: any) {
    const records = this.getPromotionRecords() || [];
    const index = records.findIndex((r: any) => r.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updates, updatedAt: new Date().toISOString() };
      this.setPromotionRecords(records);
      return records[index];
    }
    return null;
  }

  /**
   * Update customer service member
   */
  updateCS(id: string, updates: any) {
    const csTeam = this.getCSTeam() || [];
    const index = csTeam.findIndex((cs: any) => cs.id === id);
    if (index !== -1) {
      csTeam[index] = { ...csTeam[index], ...updates };
      this.setCSTeam(csTeam);
      return csTeam[index];
    }
    return null;
  }

  /**
   * Add customer service member
   */
  addCS(cs: any) {
    const csTeam = this.getCSTeam() || [];
    csTeam.push(cs);
    this.setCSTeam(csTeam);
    return cs;
  }

  /**
   * Delete customer service member
   */
  deleteCS(id: string) {
    const csTeam = this.getCSTeam() || [];
    const filtered = csTeam.filter((cs: any) => cs.id !== id);
    this.setCSTeam(filtered);
    return true;
  }

  /**
   * Get app generation requests
   */
  getAppRequests() {
    return this.getModel(MODEL_KEYS.APP_REQUESTS, []);
  }

  /**
   * Set app generation requests
   */
  setAppRequests(requests: any[]) {
    this.setModel(MODEL_KEYS.APP_REQUESTS, requests);
  }

  /**
   * Get CS app revenue
   */
  getCSAppRevenue() {
    return this.getModel(MODEL_KEYS.CS_APP_REVENUE, []);
  }

  /**
   * Set CS app revenue
   */
  setCSAppRevenue(revenue: any[]) {
    this.setModel(MODEL_KEYS.CS_APP_REVENUE, revenue);
  }

  /**
   * Get daily statistics
   */
  getDailyStats() {
    return this.getModel(MODEL_KEYS.DAILY_STATS, []);
  }

  /**
   * Set daily statistics
   */
  setDailyStats(stats: any[]) {
    this.setModel(MODEL_KEYS.DAILY_STATS, stats);
  }

  /**
   * Get app by ID
   */
  getAppById(appId: string) {
    const apps = this.getApps() || [];
    return apps.find((app: any) => app.id === appId) || null;
  }

  /**
   * Get CS by ID
   */
  getCSById(csId: string) {
    const csTeam = this.getCSTeam() || [];
    return csTeam.find((cs: any) => cs.id === csId) || null;
  }

  /**
   * Get tech by ID
   */
  getTechById(techId: string) {
    const techTeam = this.getTechTeam() || [];
    return techTeam.find((tech: any) => tech.id === techId) || null;
  }

  /**
   * Get notifications
   */
  getNotifications() {
    return this.getModel(MODEL_KEYS.NOTIFICATIONS, []);
  }

  /**
   * Set notifications
   */
  setNotifications(notifications: any[]) {
    this.setModel(MODEL_KEYS.NOTIFICATIONS, notifications);
  }

  /**
   * Add notification
   */
  addNotification(notification: any) {
    const notifications = this.getNotifications() || [];
    notifications.unshift(notification);
    this.setNotifications(notifications);
    return notification;
  }

  /**
   * Get bugs
   */
  getBugs() {
    return this.getModel(MODEL_KEYS.BUGS, []);
  }

  /**
   * Set bugs
   */
  setBugs(bugs: any[]) {
    this.setModel(MODEL_KEYS.BUGS, bugs);
  }

  /**
   * Add bug
   */
  addBug(bug: any) {
    const bugs = this.getBugs() || [];
    bugs.unshift(bug);
    this.setBugs(bugs);
    return bug;
  }

  /**
   * Get builds list
   */
  getBuilds() {
    return this.getModel(MODEL_KEYS.BUILDS, []);
  }

  /**
   * Set builds list
   */
  setBuilds(builds: any[]) {
    this.setModel(MODEL_KEYS.BUILDS, builds);
  }

  /**
   * Add build
   */
  addBuild(build: any) {
    const builds = this.getBuilds() || [];
    builds.unshift(build);
    this.setBuilds(builds);
    return build;
  }

  /**
   * Update build
   */
  updateBuild(id: string, updates: any) {
    const builds = this.getBuilds() || [];
    const index = builds.findIndex((b: any) => b.id === id);
    if (index !== -1) {
      builds[index] = { ...builds[index], ...updates };
      this.setBuilds(builds);
      return builds[index];
    }
    return null;
  }
}

// Export singleton
export const modelService = new ModelService();


