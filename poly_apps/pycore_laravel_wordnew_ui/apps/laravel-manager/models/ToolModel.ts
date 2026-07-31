import { ToolDefinition, ToolHistoryItem, ValidationResult } from '../types';
import { api } from '../api';

/**
 * ToolModel - Base class for tool models
 */
export class ToolModel {
  protected config: ToolDefinition;
  protected history: ToolHistoryItem[] = [];
  protected favorites: Set<string> = new Set();

  constructor(config: ToolDefinition) {
    this.config = config;
    this.loadHistory();
    this.loadFavorites();
  }

  /**
   * Execute the tool
   */
  async execute(input: any): Promise<any> {
    // Validate input
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      // Call the API
      const [moduleName, methodName] = this.config.apiMethod.split('.');
      const apiModule = (api as any)[moduleName];

      if (!apiModule || typeof apiModule[methodName] !== 'function') {
        throw new Error(`API method not found: ${this.config.apiMethod}`);
      }

      const response = await apiModule[methodName](input);

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      // Save to history
      if (this.config.history) {
        this.addToHistory(input, response.data, true);
      }

      return response.data;
    } catch (error: any) {
      // Save the failure record
      if (this.config.history) {
        this.addToHistory(input, null, false);
      }
      throw error;
    }
  }

  /**
   * Validate input
   */
  validate(input: any): ValidationResult {
    const errors: string[] = [];

    // Validate using inputSchema
    if (this.config.inputSchema) {
      // Simple validation logic; JSON Schema could be used instead
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
   * Get the history records
   */
  getHistory(): ToolHistoryItem[] {
    return [...this.history].reverse(); // Newest first
  }

  /**
   * Add to history
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

    // Keep at most 20 entries
    if (this.history.length > 20) {
      this.history.shift();
    }

    this.saveHistory();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Delete a history item
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
   * Save history to localStorage
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
   * Load history from localStorage
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
   * Toggle favorite
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
   * Whether this tool is favorited
   */
  isFavorite(): boolean {
    return this.favorites.has(this.config.id);
  }

  /**
   * Save favorites
   */
  protected saveFavorites(): void {
    try {
      localStorage.setItem('tool_favorites', JSON.stringify(Array.from(this.favorites)));
    } catch (error) {
      console.warn('Failed to save favorites:', error);
    }
  }

  /**
   * Load favorites
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
   * Get the configuration
   */
  getConfig(): ToolDefinition {
    return { ...this.config };
  }
}

