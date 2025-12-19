/**
 * Model 数据中心化服务
 * 统一管理所有数据模型和状态
 */
import { storageService } from './storageService';

// Model 数据键
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
} as const;

/**
 * Model 数据中心化服务类
 */
class ModelService {
  /**
   * 获取模型数据
   */
  getModel<T>(key: string, defaultValue?: T): T | null {
    return storageService.get<T>(key, defaultValue);
  }

  /**
   * 设置模型数据
   */
  setModel<T>(key: string, value: T): void {
    storageService.set(key, value);
  }

  /**
   * 删除模型数据
   */
  removeModel(key: string): void {
    storageService.remove(key);
  }

  /**
   * 清空所有模型数据
   */
  clearAllModels(): void {
    Object.values(MODEL_KEYS).forEach((key) => {
      this.removeModel(key);
    });
  }

  /**
   * 获取应用列表
   */
  getApps() {
    return this.getModel(MODEL_KEYS.APPS, []);
  }

  /**
   * 设置应用列表
   */
  setApps(apps: any[]) {
    this.setModel(MODEL_KEYS.APPS, apps);
  }

  /**
   * 获取客服团队数据
   */
  getCSTeam() {
    return this.getModel(MODEL_KEYS.CS_TEAM, []);
  }

  /**
   * 设置客服团队数据
   */
  setCSTeam(team: any[]) {
    this.setModel(MODEL_KEYS.CS_TEAM, team);
  }

  /**
   * 获取技术团队数据
   */
  getTechTeam() {
    return this.getModel(MODEL_KEYS.TECH_TEAM, []);
  }

  /**
   * 设置技术团队数据
   */
  setTechTeam(team: any[]) {
    this.setModel(MODEL_KEYS.TECH_TEAM, team);
  }

  /**
   * 获取收益数据
   */
  getRevenue() {
    return this.getModel(MODEL_KEYS.REVENUE, {});
  }

  /**
   * 设置收益数据
   */
  setRevenue(revenue: any) {
    this.setModel(MODEL_KEYS.REVENUE, revenue);
  }

  /**
   * 获取统计数据
   */
  getStatistics() {
    return this.getModel(MODEL_KEYS.STATISTICS, {});
  }

  /**
   * 设置统计数据
   */
  setStatistics(statistics: any) {
    this.setModel(MODEL_KEYS.STATISTICS, statistics);
  }

  /**
   * 获取推广轨迹数据
   */
  getPromotionTracks() {
    return this.getModel(MODEL_KEYS.PROMOTION_TRACKS, []);
  }

  /**
   * 设置推广轨迹数据
   */
  setPromotionTracks(tracks: any[]) {
    this.setModel(MODEL_KEYS.PROMOTION_TRACKS, tracks);
  }

  /**
   * 添加推广轨迹
   */
  addPromotionTrack(track: any) {
    const tracks = this.getPromotionTracks() || [];
    tracks.unshift(track); // 添加到开头
    this.setPromotionTracks(tracks);
    return track;
  }

  /**
   * 获取APP发布记录
   */
  getAppReleases() {
    return this.getModel(MODEL_KEYS.APP_RELEASES, []);
  }

  /**
   * 设置APP发布记录
   */
  setAppReleases(releases: any[]) {
    this.setModel(MODEL_KEYS.APP_RELEASES, releases);
  }

  /**
   * 添加APP发布记录
   */
  addAppRelease(release: any) {
    const releases = this.getAppReleases() || [];
    releases.unshift(release); // 添加到开头
    this.setAppReleases(releases);
    return release;
  }

  /**
   * 获取推广人员列表
   */
  getPromoters() {
    return this.getModel(MODEL_KEYS.PROMOTERS, []);
  }

  /**
   * 设置推广人员列表
   */
  setPromoters(promoters: any[]) {
    this.setModel(MODEL_KEYS.PROMOTERS, promoters);
  }

  /**
   * 添加推广人员
   */
  addPromoter(promoter: any) {
    const promoters = this.getPromoters() || [];
    promoters.push(promoter);
    this.setPromoters(promoters);
    return promoter;
  }

  /**
   * 更新推广人员
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
   * 获取推广记录列表
   */
  getPromotionRecords() {
    return this.getModel(MODEL_KEYS.PROMOTION_RECORDS, []);
  }

  /**
   * 设置推广记录列表
   */
  setPromotionRecords(records: any[]) {
    this.setModel(MODEL_KEYS.PROMOTION_RECORDS, records);
  }

  /**
   * 添加推广记录
   */
  addPromotionRecord(record: any) {
    const records = this.getPromotionRecords() || [];
    records.unshift(record); // 添加到开头
    this.setPromotionRecords(records);
    return record;
  }

  /**
   * 更新推广记录
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
   * 更新客服人员
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
   * 添加客服人员
   */
  addCS(cs: any) {
    const csTeam = this.getCSTeam() || [];
    csTeam.push(cs);
    this.setCSTeam(csTeam);
    return cs;
  }

  /**
   * 删除客服
   */
  deleteCS(id: string) {
    const csTeam = this.getCSTeam() || [];
    const filtered = csTeam.filter((cs: any) => cs.id !== id);
    this.setCSTeam(filtered);
    return true;
  }
}

// 导出单例
export const modelService = new ModelService();

