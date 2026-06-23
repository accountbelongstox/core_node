/**
 * Web shim for @capacitor/dialog (wordflow end).
 * Maps native dialogs to the browser's window dialogs. WordFlow's DialogService
 * prefers its own React fallback on web, so these are a safety net only.
 */

export const Dialog = {
  async alert(options: { title?: string; message: string; buttonTitle?: string }): Promise<void> {
    window.alert(options.message);
  },
  async confirm(options: {
    title?: string;
    message: string;
    okButtonTitle?: string;
    cancelButtonTitle?: string;
  }): Promise<{ value: boolean }> {
    return { value: window.confirm(options.message) };
  },
  async prompt(options: {
    title?: string;
    message: string;
    okButtonTitle?: string;
    cancelButtonTitle?: string;
    inputPlaceholder?: string;
    inputText?: string;
  }): Promise<{ value: string; cancelled: boolean }> {
    const result = window.prompt(options.message, options.inputText || '');
    if (result === null) return { value: '', cancelled: true };
    return { value: result, cancelled: false };
  },
};

export default { Dialog };
