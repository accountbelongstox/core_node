/**
 * Web shim for @capacitor/toast (wordnew end).
 * No-op-ish: logs to console. WordNew's ToastService renders its own HTML toast
 * on web, so this only catches direct Toast.show() calls.
 */

export const Toast = {
  async show(options: { text: string; duration?: 'short' | 'long'; position?: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[toast]', options.text);
  },
};

export default { Toast };
