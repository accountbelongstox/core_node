/**
 * Offscreen Document manager
 * Ensures only one offscreen document is created across the entire extension to avoid conflicts
 */

import { AsyncOperationController } from './async';

export class OffscreenManager {
  private static instance: OffscreenManager | null = null;
  private isCreated = false;
  private readonly creation = new AsyncOperationController<void>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OffscreenManager {
    if (!OffscreenManager.instance) {
      OffscreenManager.instance = new OffscreenManager();
    }
    return OffscreenManager.instance;
  }

  /**
   * Ensure offscreen document exists
   */
  public async ensureOffscreenDocument(): Promise<void> {
    if (import.meta.env.FIREFOX) {
      // Firefox has no offscreen API; offscreen responsibilities run inline in
      // the background event page (see utils/inline-similarity-host.ts), so
      // readiness is immediate and nothing may await a real document here.
      this.isCreated = true;
      return;
    }

    if (this.isCreated) {
      return;
    }

    return this.creation.run(() => this._doCreateOffscreenDocument());
  }

  private async _doCreateOffscreenDocument(): Promise<void> {
    try {
      if (!chrome.offscreen) {
        throw new Error('Offscreen API not available. Chrome 109+ required.');
      }

      const existingContexts = await (chrome.runtime as any).getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });

      if (existingContexts && existingContexts.length > 0) {
        console.log('OffscreenManager: Offscreen document already exists');
        this.isCreated = true;
        return;
      }

      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Need to run semantic similarity engine with workers',
      });

      this.isCreated = true;
      console.log('OffscreenManager: Offscreen document created successfully');
    } catch (error) {
      console.error('OffscreenManager: Failed to create offscreen document:', error);
      this.isCreated = false;
      throw error;
    }
  }

  /**
   * Check if offscreen document is created
   */
  public isOffscreenDocumentCreated(): boolean {
    return this.isCreated;
  }

  /**
   * Close offscreen document
   */
  public async closeOffscreenDocument(): Promise<void> {
    if (import.meta.env.FIREFOX) {
      // No offscreen document exists on Firefox; just reset the inline flag
      this.isCreated = false;
      return;
    }

    try {
      if (chrome.offscreen && this.isCreated) {
        await chrome.offscreen.closeDocument();
        this.isCreated = false;
        console.log('OffscreenManager: Offscreen document closed');
      }
    } catch (error) {
      console.error('OffscreenManager: Failed to close offscreen document:', error);
    }
  }

  /**
   * Reset state (for testing)
   */
  public reset(): void {
    this.isCreated = false;
    this.creation.reset();
  }
}


export const offscreenManager = OffscreenManager.getInstance();
