import { api } from '../api';
import { BaseModel, ModelResult } from './BaseModel';

/**
 * MCP Model - MCP manager business model
 * Uses namespaces to organize the different feature modules
 */
export class McpModel extends BaseModel {
  private static instance: McpModel;

  private constructor() {
    super();
  }

  static getInstance(): McpModel {
    if (!McpModel.instance) {
      McpModel.instance = new McpModel();
    }
    return McpModel.instance;
  }

  // ========== Screenshots namespace ==========
  screenshots = {
    list: (page: number = 1, limit: number = 20) =>
      this.execute(api.mcpV1.getScreenshots(page, limit)),

    upload: (image: File, options?: { description?: string; keywords?: string[]; id?: string; replace?: boolean }) =>
      this.execute(api.mcpV1.uploadScreenshot({ image, ...options })),

    uploadMerge: (images: File[], options?: { descriptions?: string[]; keyword?: string; id?: string; replace?: boolean }) =>
      this.execute(api.mcpV1.uploadMerge({ images, ...options })),

    uploadBatch: (images: File[], options?: { descriptions?: string[]; keyword?: string }) =>
      this.execute(api.mcpV1.uploadBatch({ images, ...options })),

    delete: (id: string) =>
      this.execute(api.mcpV1.deleteScreenshot(id)),

    clearAll: () =>
      this.execute(api.mcpV1.get('/screenshots/clear-all', undefined, false)),

    stats: () =>
      this.execute(api.mcpV1.get('/screenshots/stats'))
  };

  // ========== Tasks namespace ==========
  tasks = {
    getCategories: () =>
      this.execute(api.mcpV1.getTaskCategories()),

    getQueue: (categoryId: string) =>
      this.execute(api.mcpV1.getTaskQueue(categoryId)),

    getStats: (categoryId: string) =>
      this.execute(api.mcpV1.getQueueStats(categoryId)),

    add: (data: { category_id: string; content: string; file_name?: string; priority?: number }) =>
      this.execute(api.mcpV1.addTask(data)),

    execute: (taskId: string) =>
      this.execute(api.mcpV1.executeTask(taskId))
  };

  // ========== Prompts namespace ==========
  prompts = {
    getMappings: () =>
      this.execute(api.mcpV1.getPromptMappings()),

    updateMapping: (categoryId: string, promptFilePath: string, promptContent?: string) =>
      this.execute(api.mcpV1.updatePromptMapping(categoryId, promptFilePath, promptContent))
  };

  // ========== Placeholders namespace ==========
  placeholders = {
    list: () =>
      this.execute(api.mcpV1.getPlaceholders()),

    generate: (data: {
      width: number;
      height: number;
      text?: string;
      bg_color?: string;
      text_color?: string;
      format?: 'png' | 'jpg' | 'svg' | 'webp';
      mode?: 'simple' | 'real';
    }) =>
      this.execute(api.mcpV1.generatePlaceholder(data)),

    delete: (uuid: string) =>
      this.execute(api.mcpV1.deletePlaceholder(uuid)),

    stats: () =>
      this.execute(api.mcpV1.getPlaceholderStats())
  };

  // ========== OCR namespace ==========
  ocr = {
    recognize: (image: File, engine?: string) =>
      this.execute(api.mcpV1.ocrRecognize({ image, engine })),

    smartRecognize: (image: File) =>
      this.execute(api.mcpV1.ocrSmartRecognize({ image })),

    batch: (images: File[]) =>
      this.execute(api.mcpV1.ocrBatch({ images })),

    getEngines: () =>
      this.execute(api.mcpV1.getOcrEngines()),

    getEngineInfo: (engine: string) =>
      this.execute(api.mcpV1.getOcrEngineInfo(engine))
  };

  // ========== Voice Subtitle namespace ==========
  voiceSubtitle = {
    queue: {
      list: (page?: number, limit?: number) =>
        this.execute(api.mcpV1.vsGetQueue({ page, limit })),

      latest: () =>
        this.execute(api.mcpV1.vsGetQueueLatest()),

      today: () =>
        this.execute(api.mcpV1.vsGetQueueToday()),

      byCategory: (category: string) =>
        this.execute(api.mcpV1.vsGetQueueByCategory(category)),

      byGroup: (group?: string) =>
        this.execute(api.mcpV1.vsGetQueueByGroup(group)),

      clear: () =>
        this.execute(api.mcpV1.vsClearQueue())
    },

    add: {
      text: (text: string, options?: { language?: string; group?: string }) =>
        this.execute(api.mcpV1.vsAddText({ text, ...options })),

      image: (image: File, options?: { description?: string; group?: string }) =>
        this.execute(api.mcpV1.vsAddImage({ image, ...options })),

      voice: (voice: File, options?: { title?: string; group?: string }) =>
        this.execute(api.mcpV1.vsAddVoice({ voice, ...options }))
    },

    navigation: {
      current: () =>
        this.execute(api.mcpV1.vsGetCurrent()),

      next: () =>
        this.execute(api.mcpV1.vsNext()),

      previous: () =>
        this.execute(api.mcpV1.vsPrevious()),

      setIndex: (index: number) =>
        this.execute(api.mcpV1.vsSetIndex(index))
    },

    remove: {
      item: (id: string) =>
        this.execute(api.mcpV1.vsRemoveItem(id)),

      items: (ids: string[]) =>
        this.execute(api.mcpV1.vsRemoveItems(ids))
    },

    incrementPlayCount: (id: string) =>
      this.execute(api.mcpV1.vsIncrementPlayCount(id)),

    updateGroup: (id: string, group: string) =>
      this.execute(api.mcpV1.vsUpdateItemGroup({ id, group })),

    stats: () =>
      this.execute(api.mcpV1.vsGetStats()),

    groups: () =>
      this.execute(api.mcpV1.vsGetAllGroups()),

    categories: () =>
      this.execute(api.mcpV1.vsGetCategories()),

    tasks: {
      list: () =>
        this.execute(api.mcpV1.vsListTasks()),

      delete: (taskIds: string[]) =>
        this.execute(api.mcpV1.vsDeleteTasks(taskIds)),

      getStatus: (taskId: string) =>
        this.execute(api.mcpV1.vsGetTaskStatus(taskId))
    },

    settings: {
      get: () =>
        this.execute(api.mcpV1.vsGetUserSettings()),

      update: (settings: any) =>
        this.execute(api.mcpV1.vsUpdateUserSettings(settings))
    },

    languages: () =>
      this.execute(api.mcpV1.vsGetSupportedLanguages()),

    ping: () =>
      this.execute(api.mcpV1.vsPing())
  };

  // ========== Static Resources namespace ==========
  staticResources = {
    getTree: (path?: string) =>
      this.execute(api.mcpV1.getStaticResourcesTree(path)),

    upload: (files: File[]) =>
      this.execute(api.mcpV1.uploadStaticResources(files)),

    getStreamUrl: (path: string) =>
      api.mcpV1.getStaticFileStreamUrl(path)
  };

  // Legacy method aliases for backward compatibility (deprecated)
  uploadScreenshot = this.screenshots.upload;
  deleteScreenshot = this.screenshots.delete;
  getScreenshots = this.screenshots.list;
}

export const mcpModel = McpModel.getInstance();
