import { useState, useEffect, useCallback } from 'react';
import { ToolModel } from '../core/models';
import { ToolConfig, ToolHistoryItem } from '../core/types';

/**
 * React Hook for ToolModel
 * Provides state management and methods for tool execution
 */
export function useToolModel(config: ToolConfig) {
  const [tool] = useState(() => new ToolModel(config));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<ToolHistoryItem[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);

  // Load initial data
  useEffect(() => {
    setHistory(tool.getHistory());
    setIsFavorite(tool.isFavorite());
  }, [tool]);

  /**
   * Execute the tool
   */
  const execute = useCallback(async (input: any) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const output = await tool.execute(input);
      setResult(output);
      setHistory(tool.getHistory());
      return output;
    } catch (err: any) {
      const errorMessage = err.message || 'Execution failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tool]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear result
   */
  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  /**
   * Toggle favorite
   */
  const toggleFavorite = useCallback(() => {
    tool.toggleFavorite();
    setIsFavorite(tool.isFavorite());
  }, [tool]);

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    tool.clearHistory();
    setHistory([]);
  }, [tool]);

  /**
   * Delete history item
   */
  const deleteHistoryItem = useCallback((index: number) => {
    tool.deleteHistoryItem(index);
    setHistory(tool.getHistory());
  }, [tool]);

  /**
   * Validate input
   */
  const validate = useCallback((input: any) => {
    return tool.validate(input);
  }, [tool]);

  return {
    // State
    loading,
    error,
    result,
    history,
    isFavorite,

    // Methods
    execute,
    clearError,
    clearResult,
    toggleFavorite,
    clearHistory,
    deleteHistoryItem,
    validate,

    // Tool instance (for advanced usage)
    tool
  };
}
