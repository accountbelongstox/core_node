/**
 * Dialog Service - Unified Dialog System
 * Supports both Capacitor native dialogs and React web fallback
 * Multi-language and dark/light mode support
 */

import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';
import { LanguageCenter } from '../i18n/LanguageCenter';

export interface AlertOptions {
  title: string;
  message: string;
  buttonTitle?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  okButtonTitle?: string;
  cancelButtonTitle?: string;
}

export interface PromptOptions {
  title: string;
  message: string;
  okButtonTitle?: string;
  cancelButtonTitle?: string;
  inputPlaceholder?: string;
  inputText?: string;
}

export interface ConfirmResult {
  value: boolean;
}

export interface PromptResult {
  value: string;
  cancelled: boolean;
}

class DialogServiceClass {
  /**
   * Show an alert dialog
   */
  async alert(options: AlertOptions): Promise<void> {
    const t = (key: string) => LanguageCenter.t(key);
    
    // Use Capacitor Dialog on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        await Dialog.alert({
          title: options.title,
          message: options.message,
          buttonTitle: options.buttonTitle || t('common.ok'),
        });
      } catch (error) {
        console.error('[DialogService] Capacitor Dialog failed, using web fallback:', error);
        this.showWebAlert(options);
      }
    } else {
      // Use web fallback for PWA/web
      this.showWebAlert(options);
    }
  }

  /**
   * Show a confirmation dialog
   */
  async confirm(options: ConfirmOptions): Promise<ConfirmResult> {
    const t = (key: string) => LanguageCenter.t(key);
    
    // Use Capacitor Dialog on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Dialog.confirm({
          title: options.title,
          message: options.message,
          okButtonTitle: options.okButtonTitle || t('common.confirm'),
          cancelButtonTitle: options.cancelButtonTitle || t('common.cancel'),
        });
        return { value: result.value };
      } catch (error) {
        console.error('[DialogService] Capacitor Dialog failed, using web fallback:', error);
        return this.showWebConfirm(options);
      }
    } else {
      // Use web fallback for PWA/web
      return this.showWebConfirm(options);
    }
  }

  /**
   * Show a prompt dialog
   */
  async prompt(options: PromptOptions): Promise<PromptResult> {
    const t = (key: string) => LanguageCenter.t(key);
    
    // Use Capacitor Dialog on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Dialog.prompt({
          title: options.title,
          message: options.message,
          okButtonTitle: options.okButtonTitle || t('common.confirm'),
          cancelButtonTitle: options.cancelButtonTitle || t('common.cancel'),
          inputPlaceholder: options.inputPlaceholder,
          inputText: options.inputText,
        });
        return { value: result.value || '', cancelled: result.cancelled };
      } catch (error) {
        console.error('[DialogService] Capacitor Dialog failed, using web fallback:', error);
        return this.showWebPrompt(options);
      }
    } else {
      // Use web fallback for PWA/web
      return this.showWebPrompt(options);
    }
  }

  /**
   * Web fallback for alert - uses React Dialog component
   */
  private async showWebAlert(options: AlertOptions): Promise<void> {
    const { showDialog } = await import('../components/Dialog');
    await showDialog({
      type: 'alert',
      title: options.title,
      message: options.message,
      okButtonTitle: options.buttonTitle,
    });
  }

  /**
   * Web fallback for confirm - uses React Dialog component
   */
  private async showWebConfirm(options: ConfirmOptions): Promise<ConfirmResult> {
    const { showDialog } = await import('../components/Dialog');
    return showDialog({
      type: 'confirm',
      title: options.title,
      message: options.message,
      okButtonTitle: options.okButtonTitle,
      cancelButtonTitle: options.cancelButtonTitle,
    });
  }

  /**
   * Web fallback for prompt - uses React Dialog component
   */
  private async showWebPrompt(options: PromptOptions): Promise<PromptResult> {
    const { showDialog } = await import('../components/Dialog');
    return showDialog({
      type: 'prompt',
      title: options.title,
      message: options.message,
      okButtonTitle: options.okButtonTitle,
      cancelButtonTitle: options.cancelButtonTitle,
      inputPlaceholder: options.inputPlaceholder,
      inputText: options.inputText,
    });
  }
}

export const DialogService = new DialogServiceClass();

