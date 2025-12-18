/**
 * Global HTML Error Manager
 * Manages HTML error responses and triggers debug modal
 */

export interface HtmlErrorEvent {
  htmlContent: string;
  url: string;
  statusCode?: number;
  timestamp: number;
}

type HtmlErrorListener = (event: HtmlErrorEvent) => void;

class HtmlErrorManager {
  private listeners: Set<HtmlErrorListener> = new Set();
  private lastError: HtmlErrorEvent | null = null;

  /**
   * Register a listener for HTML error events
   */
  addListener(listener: HtmlErrorListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Trigger HTML error event
   */
  triggerError(htmlContent: string, url: string, statusCode?: number): void {
    const event: HtmlErrorEvent = {
      htmlContent,
      url,
      statusCode,
      timestamp: Date.now()
    };

    this.lastError = event;

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[HtmlErrorManager] Error in listener:', error);
      }
    });
  }

  /**
   * Get last error (for debugging)
   */
  getLastError(): HtmlErrorEvent | null {
    return this.lastError;
  }

  /**
   * Clear last error
   */
  clearLastError(): void {
    this.lastError = null;
  }
}

// Export singleton instance
export const htmlErrorManager = new HtmlErrorManager();
