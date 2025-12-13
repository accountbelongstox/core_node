import { ToolConfig, ToolHistoryItem, ValidationResult } from '../types';
import { api } from '../api';

/**
 * ToolModel - 工具模型基类
 */
export class ToolModel {
  protected config: ToolConfig;
  protected history: ToolHistoryItem[] = [];
  protected favorites: Set<string> = new Set();

  constructor(config: ToolConfig) {
    this.config = config;
    this.loadHistory();
    this.loadFavorites();
  }

  /**
   * 执行工具
   */
  async execute(input: any): Promise<any> {
    // 验证输入
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      // 调用API
      const [moduleName, methodName] = this.config.apiMethod.split('.');
      const apiModule = (api as any)[moduleName];

      if (!apiModule || typeof apiModule[methodName] !== 'function') {
        throw new Error(`API method not found: ${this.config.apiMethod}`);
      }

      const response = await apiModule[methodName](input);

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      // 保存到历史
      if (this.config.history) {
        this.addToHistory(input, response.data, true);
      }

      return response.data;
    } catch (error: any) {
      // 保存失败记录
      if (this.config.history) {
        this.addToHistory(input, null, false);
      }
      throw error;
    }
  }

  /**
   * 验证输入
   */
  validate(input: any): ValidationResult {
    const errors: string[] = [];

    // 使用inputSchema验证
    if (this.config.inputSchema) {
      // 简单验证逻辑，实际可以使用JSON Schema
      const required = this.config.inputSchema.required || [];
      for (const field of required) {
        if (input[field] === undefined || input[field] === null || input[field] === '') {
          errors.push(`Field '${field}' is required`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取历史记录
   */
  getHistory(): ToolHistoryItem[] {
    return [...this.history].reverse(); // 最新的在前
  }

  /**
   * 添加到历史
   */
  protected addToHistory(input: any, output: any, success: boolean): void {
    const item: ToolHistoryItem = {
      id: Date.now().toString(),
      toolId: this.config.id,
      input,
      output,
      timestamp: Date.now(),
      success
    };

    this.history.push(item);

    // 最多保存20条
    if (this.history.length > 20) {
      this.history.shift();
    }

    this.saveHistory();
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * 删除历史项
   */
  deleteHistoryItem(index: number): void {
    if (index >= 0 && index < this.history.length) {
      // Note: history is stored in normal order, but getHistory() reverses it
      // So we need to convert the reversed index back to the actual index
      const actualIndex = this.history.length - 1 - index;
      this.history.splice(actualIndex, 1);
      this.saveHistory();
    }
  }

  /**
   * 保存历史到localStorage
   */
  protected saveHistory(): void {
    try {
      const key = `tool_history_${this.config.id}`;
      localStorage.setItem(key, JSON.stringify(this.history));
    } catch (error) {
      console.warn('Failed to save history:', error);
    }
  }

  /**
   * 从localStorage加载历史
   */
  protected loadHistory(): void {
    try {
      const key = `tool_history_${this.config.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load history:', error);
    }
  }

  /**
   * 切换收藏
   */
  toggleFavorite(): void {
    if (this.favorites.has(this.config.id)) {
      this.favorites.delete(this.config.id);
    } else {
      this.favorites.add(this.config.id);
    }
    this.saveFavorites();
  }

  /**
   * 是否已收藏
   */
  isFavorite(): boolean {
    return this.favorites.has(this.config.id);
  }

  /**
   * 保存收藏
   */
  protected saveFavorites(): void {
    try {
      localStorage.setItem('tool_favorites', JSON.stringify(Array.from(this.favorites)));
    } catch (error) {
      console.warn('Failed to save favorites:', error);
    }
  }

  /**
   * 加载收藏
   */
  protected loadFavorites(): void {
    try {
      const stored = localStorage.getItem('tool_favorites');
      if (stored) {
        this.favorites = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load favorites:', error);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }
}
