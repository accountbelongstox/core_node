/**
 * Web shim for @capacitor/status-bar (wordflow end). All no-ops: a web browser
 * has no native status bar. Style enum preserved so imports type-check.
 */

export enum Style {
  Dark = 'DARK',
  Light = 'LIGHT',
  Default = 'DEFAULT',
}

export const StatusBar = {
  async setStyle(_options: { style: Style }): Promise<void> {},
  async setBackgroundColor(_options: { color: string }): Promise<void> {},
  async setOverlaysWebView(_options: { overlay: boolean }): Promise<void> {},
  async show(): Promise<void> {},
  async hide(): Promise<void> {},
};

export default { StatusBar, Style };
