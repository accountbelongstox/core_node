/**
 * StudyGroupsCenter - 学习分组管理中心
 *
 * 功能：
 * - 管理用户的学习分组（Study Groups）
 * - 学习分组是用户组织学习计划的方式，可包含多个词组（Word Groups）
 * - 提供响应式更新、智能缓存和自动初始化
 *
 * 与 WordGroupsCenter 的区别：
 * - WordGroupsCenter: 管理词库（系统或用户创建的词汇集合）
 * - StudyGroupsCenter: 管理学习计划（用户组织的学习分组，包含多个词组）
 */

import type {
  StudyGroup,
  StudyGroupDetailed,
  CreateStudyGroupRequest,
  UpdateStudyGroupRequest,
  AddWordGroupToStudyGroupRequest,
  UpdateStudyProgressRequest,
  ApiResponse
} from '../types';
import { StorageCenter, StorageKey } from './StorageCenter';
import { apiManager } from './ApiManager';

type StudyGroupsListener = (groups: StudyGroup[]) => void;

class StudyGroupsCenterClass {
  private studyGroups: StudyGroup[] = [];
  private listeners: Set<StudyGroupsListener> = new Set();
  private isInitialized = false;
  private isLoading = false;
  private lastFetchTime = 0;
  private CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
  private FETCH_COOLDOWN = 15000; // 15 seconds

  /**
   * 初始化学习分组中心
   * 优先从缓存加载，然后从API获取最新数据
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[StudyGroupsCenter] Already initialized');
      return;
    }

    console.log('[StudyGroupsCenter] Initializing...');

    // 从缓存加载
    const cached = StorageCenter.cache.get<StudyGroup[]>(StorageKey.STUDY_GROUPS_CACHE);
    if (cached && cached.length > 0) {
      this.studyGroups = cached;
      this.notifyListeners();
      console.log(`[StudyGroupsCenter] Loaded ${cached.length} groups from cache`);
    }

    // 从API获取最新数据
    try {
      await this.fetchAll(true);
      this.isInitialized = true;
      console.log('[StudyGroupsCenter] Initialization complete');
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to initialize:', error);
      // 如果有缓存数据，仍然标记为已初始化
      if (this.studyGroups.length > 0) {
        this.isInitialized = true;
      }
    }
  }

  /**
   * 获取所有学习分组
   * @param forceRefresh 强制刷新，忽略缓存和防抖
   */
  async fetchAll(forceRefresh: boolean = false): Promise<StudyGroup[]> {
    const now = Date.now();

    // 防抖机制：如果最近15秒内已经请求过，直接返回缓存
    if (!forceRefresh && (now - this.lastFetchTime) < this.FETCH_COOLDOWN) {
      console.log('[StudyGroupsCenter] Fetch throttled, returning cached data');
      return this.studyGroups;
    }

    // 如果正在加载，返回当前数据
    if (this.isLoading) {
      console.log('[StudyGroupsCenter] Already loading, returning current data');
      return this.studyGroups;
    }

    this.isLoading = true;
    this.lastFetchTime = now;

    try {
      console.log('[StudyGroupsCenter] Fetching study groups from API...');

      // 调用API（后端返回格式: { uid, total, groups }）
      const response = await this.callApi<{ uid?: number; total: number; groups: any[] }>('/api/app_qy_v1/query_all_groups');

      if (response.success && response.data) {
        // 转换后端字段到前端格式 (gid->id, gname->name等)
        const rawGroups = response.data.groups || [];
        this.studyGroups = rawGroups.map((g: any) => ({
          id: g.gid || g.id,
          uid: g.uid,
          name: g.gname || g.name,
          description: g.description,
          language: g.language,
          is_language_default: g.is_language_default,
          is_default: g.is_default || g.is_language_default,
          total_word_groups: g.total_word_groups || 0,
          total_words: g.total_words || 0,
          learned_words: g.learned_words || 0,
          progress: g.progress || 0,
          daily_goal: g.daily_goal || 50,
          study_mode: g.study_mode || 'sequential',
          cover_image: g.cover_url || g.cover_image,
          color: g.color || '#3B82F6',
          icon: g.icon || '📚',
          sort_order: g.sort_order || 0,
          created_at: g.created_at,
          updated_at: g.updated_at,
          last_studied_at: g.last_studied_at
        }));

        // 保存到缓存
        StorageCenter.cache.set(
          StorageKey.STUDY_GROUPS_CACHE,
          this.studyGroups,
          this.CACHE_DURATION
        );

        // 通知所有订阅者
        this.notifyListeners();

        console.log(`[StudyGroupsCenter] Fetched ${this.studyGroups.length} study groups`);
      }

      return this.studyGroups;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to fetch study groups:', error);
      return this.studyGroups;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 刷新数据（强制从API获取）
   */
  async refresh(): Promise<void> {
    console.log('[StudyGroupsCenter] Manual refresh triggered');
    await this.fetchAll(true);
  }

  /**
   * 为指定语言创建默认背诵分组
   * @param language 语言代码（如 'en', 'zh', 'ja'）
   */
  async createLanguageGroup(language: string): Promise<StudyGroup | null> {
    try {
      console.log('[StudyGroupsCenter] Creating language study group:', language);

      const response = await this.callApi<any>('/api/app_qy_v1/study_groups/create_for_language', {
        method: 'POST',
        body: JSON.stringify({ language })
      });

      if (response.success && response.data) {
        const rawGroup = response.data;

        // 转换后端字段到前端格式
        const newGroup: StudyGroup = {
          id: rawGroup.id || rawGroup.gid,
          uid: rawGroup.uid,
          name: rawGroup.name || rawGroup.gname,
          description: rawGroup.description,
          language: rawGroup.language,
          is_language_default: rawGroup.is_language_default,
          is_default: rawGroup.is_default || rawGroup.is_language_default,
          total_word_groups: rawGroup.total_word_groups || 0,
          total_words: rawGroup.total_words || 0,
          learned_words: rawGroup.learned_words || 0,
          progress: rawGroup.progress || 0,
          daily_goal: rawGroup.daily_goal || 50,
          study_mode: rawGroup.study_mode || 'sequential',
          cover_image: rawGroup.cover_url || rawGroup.cover_image,
          color: rawGroup.color || '#3B82F6',
          icon: rawGroup.icon || '📚',
          sort_order: rawGroup.sort_order || 0,
          created_at: rawGroup.created_at,
          updated_at: rawGroup.updated_at,
          last_studied_at: rawGroup.last_studied_at
        };

        // 更新本地缓存
        const index = this.studyGroups.findIndex(g => g.id === newGroup.id);
        if (index >= 0) {
          this.studyGroups[index] = newGroup;
        } else {
          this.studyGroups.push(newGroup);
        }

        // 按语言和sort_order排序
        this.studyGroups.sort((a, b) => {
          if (a.language !== b.language) {
            return a.language.localeCompare(b.language);
          }
          return a.sort_order - b.sort_order;
        });

        this.notifyListeners();
        this.updateCache();

        console.log('[StudyGroupsCenter] Language study group created:', newGroup.id);
        return newGroup;
      }

      return null;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to create language group:', error);
      return null;
    }
  }

  /**
   * 获取指定语言的所有背诵分组
   * @param language 语言代码
   */
  async getByLanguage(language: string): Promise<StudyGroup[]> {
    try {
      console.log('[StudyGroupsCenter] Fetching study groups for language:', language);

      const response = await this.callApi<{ language: string; study_groups: any[]; total: number }>(
        `/api/app_qy_v1/study_groups/by_language/${language}`
      );

      if (response.success && response.data) {
        const rawGroups = response.data.study_groups || [];

        // 转换后端字段到前端格式
        const groups: StudyGroup[] = rawGroups.map((g: any) => ({
          id: g.id || g.gid,
          uid: g.uid,
          name: g.name || g.gname,
          description: g.description,
          language: g.language,
          is_language_default: g.is_language_default,
          is_default: g.is_default || g.is_language_default,
          total_word_groups: g.total_word_groups || 0,
          total_words: g.total_words || 0,
          learned_words: g.learned_words || 0,
          progress: g.progress || 0,
          daily_goal: g.daily_goal || 50,
          study_mode: g.study_mode || 'sequential',
          cover_image: g.cover_url || g.cover_image,
          color: g.color || '#3B82F6',
          icon: g.icon || '📚',
          sort_order: g.sort_order || 0,
          created_at: g.created_at,
          updated_at: g.updated_at,
          last_studied_at: g.last_studied_at
        }));

        // 更新本地缓存中对应语言的分组
        this.studyGroups = this.studyGroups.filter(g => g.language !== language);
        this.studyGroups.push(...groups);

        this.notifyListeners();
        this.updateCache();

        return groups;
      }

      return [];
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to fetch groups by language:', error);
      return [];
    }
  }

  /**
   * 获取默认学习分组（废弃，使用 getLanguageDefaultGroup）
   * @deprecated 使用 getLanguageDefaultGroup(language) 代替
   */
  async getDefaultGroup(): Promise<StudyGroup | null> {
    console.warn('[StudyGroupsCenter] getDefaultGroup() is deprecated, use getLanguageDefaultGroup(language)');

    // 返回第一个语言的默认分组作为兼容
    const defaultGroups = this.studyGroups.filter(g => g.is_language_default);
    return defaultGroups.length > 0 ? defaultGroups[0] : null;
  }

  /**
   * 获取指定语言的默认背诵分组
   * @param language 语言代码
   */
  getLanguageDefaultGroup(language: string): StudyGroup | undefined {
    return this.studyGroups.find(g => g.language === language && g.is_language_default);
  }

  /**
   * 创建新的学习分组
   */
  async create(request: CreateStudyGroupRequest): Promise<StudyGroup | null> {
    try {
      console.log('[StudyGroupsCenter] Creating study group:', request.name);

      const response = await this.callApi<StudyGroup>('/api/study_groups/create', {
        method: 'POST',
        body: JSON.stringify(request)
      });

      if (response.success && response.data) {
        const newGroup = response.data;

        // 添加到本地列表
        this.studyGroups.push(newGroup);

        // 按sort_order排序
        this.studyGroups.sort((a, b) => a.sort_order - b.sort_order);

        this.notifyListeners();
        this.updateCache();

        console.log('[StudyGroupsCenter] Study group created:', newGroup.id);
        return newGroup;
      }

      return null;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to create study group:', error);
      return null;
    }
  }

  /**
   * 更新学习分组
   */
  async update(groupId: string, request: UpdateStudyGroupRequest): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Updating study group:', groupId);

      const response = await this.callApi<StudyGroup>(`/api/study_groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(request)
      });

      if (response.success && response.data) {
        // 更新本地数据
        const index = this.studyGroups.findIndex(g => g.id === groupId);
        if (index >= 0) {
          this.studyGroups[index] = response.data;
          this.notifyListeners();
          this.updateCache();
        }

        console.log('[StudyGroupsCenter] Study group updated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to update study group:', error);
      return false;
    }
  }

  /**
   * 删除学习分组
   */
  async delete(groupId: string): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Deleting study group:', groupId);

      const response = await this.callApi<void>(`/api/study_groups/${groupId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        // 从本地列表移除
        this.studyGroups = this.studyGroups.filter(g => g.id !== groupId);
        this.notifyListeners();
        this.updateCache();

        console.log('[StudyGroupsCenter] Study group deleted');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to delete study group:', error);
      return false;
    }
  }

  /**
   * 获取学习分组详情（包含所有词组）
   */
  async getById(groupId: string): Promise<StudyGroupDetailed | null> {
    try {
      console.log('[StudyGroupsCenter] Fetching study group details:', groupId);

      const response = await this.callApi<StudyGroupDetailed>(`/api/study_groups/${groupId}`);

      if (response.success && response.data) {
        // 更新本地基本信息
        const index = this.studyGroups.findIndex(g => g.id === groupId);
        if (index >= 0) {
          const { word_groups, ...basicInfo } = response.data;
          this.studyGroups[index] = basicInfo;
          this.notifyListeners();
        }

        return response.data;
      }

      return null;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to fetch study group details:', error);
      return null;
    }
  }

  /**
   * 向学习分组添加词组
   */
  async addWordGroup(groupId: string, request: AddWordGroupToStudyGroupRequest): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Adding word group to study group:', groupId, request.word_group_id);

      const response = await this.callApi<any>(`/api/study_groups/${groupId}/add_word_group`, {
        method: 'POST',
        body: JSON.stringify(request)
      });

      if (response.success) {
        // 刷新数据以获取更新后的统计信息
        await this.fetchAll(true);

        console.log('[StudyGroupsCenter] Word group added successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to add word group:', error);
      return false;
    }
  }

  /**
   * 从学习分组移除词组
   */
  async removeWordGroup(groupId: string, wordGroupId: string): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Removing word group from study group:', groupId, wordGroupId);

      const response = await this.callApi<void>(
        `/api/study_groups/${groupId}/remove_word_group/${wordGroupId}`,
        { method: 'DELETE' }
      );

      if (response.success) {
        // 刷新数据以获取更新后的统计信息
        await this.fetchAll(true);

        console.log('[StudyGroupsCenter] Word group removed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to remove word group:', error);
      return false;
    }
  }

  /**
   * 更新学习进度
   */
  async updateProgress(groupId: string, request: UpdateStudyProgressRequest): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Updating study progress:', groupId);

      const response = await this.callApi<{ progress: number; status: string }>(
        `/api/study_groups/${groupId}/update_progress`,
        {
          method: 'POST',
          body: JSON.stringify(request)
        }
      );

      if (response.success) {
        // 刷新数据
        await this.fetchAll(true);

        console.log('[StudyGroupsCenter] Progress updated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to update progress:', error);
      return false;
    }
  }

  /**
   * 设置默认学习分组
   */
  async setDefault(groupId: string): Promise<boolean> {
    try {
      console.log('[StudyGroupsCenter] Setting default study group:', groupId);

      const response = await this.callApi<void>(`/api/study_groups/${groupId}/set_default`, {
        method: 'POST'
      });

      if (response.success) {
        // 更新本地数据
        this.studyGroups.forEach(g => {
          g.is_default = (g.id === groupId);
        });

        this.notifyListeners();
        this.updateCache();

        console.log('[StudyGroupsCenter] Default study group updated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[StudyGroupsCenter] Failed to set default:', error);
      return false;
    }
  }

  /**
   * 订阅学习分组变化
   */
  subscribe(listener: StudyGroupsListener): () => void {
    this.listeners.add(listener);

    // 立即调用一次，传递当前数据
    listener([...this.studyGroups]);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取当前所有学习分组（同步）
   */
  getAll(): StudyGroup[] {
    return [...this.studyGroups];
  }

  /**
   * 按ID查找学习分组（同步）
   */
  findById(id: string): StudyGroup | undefined {
    return this.studyGroups.find(g => g.id === id);
  }

  /**
   * 获取默认分组（同步）
   */
  findDefault(): StudyGroup | undefined {
    return this.studyGroups.find(g => g.is_default);
  }

  /**
   * 按语言过滤学习分组（同步）
   * @param language 语言代码
   */
  filterByLanguage(language: string): StudyGroup[] {
    return this.studyGroups.filter(g => g.language === language);
  }

  /**
   * 搜索学习分组
   */
  search(query: string): StudyGroup[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.studyGroups;

    return this.studyGroups.filter(group =>
      group.name.toLowerCase().includes(lowerQuery) ||
      (group.description && group.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      total: this.studyGroups.length,
      totalWords: this.studyGroups.reduce((sum, g) => sum + g.total_words, 0),
      learnedWords: this.studyGroups.reduce((sum, g) => sum + g.learned_words, 0),
      totalWordGroups: this.studyGroups.reduce((sum, g) => sum + g.total_word_groups, 0),
      averageProgress: this.studyGroups.length > 0
        ? this.studyGroups.reduce((sum, g) => sum + g.progress, 0) / this.studyGroups.length
        : 0
    };
  }

  // ========== 私有方法 ==========

  /**
   * 通知所有订阅者
   */
  private notifyListeners(): void {
    const groupsCopy = [...this.studyGroups];
    this.listeners.forEach(listener => {
      try {
        listener(groupsCopy);
      } catch (error) {
        console.error('[StudyGroupsCenter] Error in listener:', error);
      }
    });
  }

  /**
   * 更新缓存
   */
  private updateCache(): void {
    StorageCenter.cache.set(
      StorageKey.STUDY_GROUPS_CACHE,
      this.studyGroups,
      this.CACHE_DURATION
    );
  }

  /**
   * API调用辅助方法
   */
  private async callApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      // 获取token
      const token = StorageCenter.auth.getToken();
      if (!token) {
        return {
          success: false,
          data: {} as T,
          message: '未登录'
        };
      }

      // 使用 ApiManager 获取当前活动的 base URL
      const baseUrl = apiManager.getCurrentBaseUrl();
      const url = `${baseUrl}${endpoint}`;

      // 发起请求
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options?.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: {} as T,
          message: data.message || '请求失败'
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message
      };
    } catch (error) {
      console.error('[StudyGroupsCenter] API call failed:', error);
      return {
        success: false,
        data: {} as T,
        message: error instanceof Error ? error.message : '网络错误'
      };
    }
  }
}

// 导出单例
export const StudyGroupsCenter = new StudyGroupsCenterClass();
