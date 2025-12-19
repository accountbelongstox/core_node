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
}

// 导出单例
export const modelService = new ModelService();

