/**
 * Central soft-keyboard (IME) state. Publishes `html[data-soft-keyboard="open"]`
 * and `--soft-keyboard-height` so layout reacts in CSS: floating bottom chrome
 * tagged with SOFT_KEYBOARD_HIDE_CLASS is hidden instead of riding up on the IME.
 * Native: @capacitor/keyboard events. Web: layout/visual viewport shrink while
 * an editable element has focus (index.html uses interactive-widget=resizes-content).
 */
import { Keyboard } from '@capacitor/keyboard';
import { isNativeAppShell } from '../network/NativeShell';

export const SOFT_KEYBOARD_ATTR = 'data-soft-keyboard';
export const SOFT_KEYBOARD_HEIGHT_VAR = '--soft-keyboard-height';
export const SOFT_KEYBOARD_HIDE_CLASS = 'hide-on-soft-keyboard';

const OPEN_THRESHOLD_PX = 120;
const EDITABLE_SELECTOR = 'input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=file]),textarea,select,[contenteditable=""],[contenteditable="true"]';

let installed = false;
let baselineHeight = 0;
let baselineWidth = 0;

function publish(open: boolean, height: number): void {
  const root = document.documentElement;
  if (open) root.setAttribute(SOFT_KEYBOARD_ATTR, 'open');
  else root.removeAttribute(SOFT_KEYBOARD_ATTR);
  root.style.setProperty(SOFT_KEYBOARD_HEIGHT_VAR, `${open ? Math.max(0, Math.round(height)) : 0}px`);
}

function hasEditableFocus(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches(EDITABLE_SELECTOR);
}

function currentViewportHeight(): number {
  return Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
}

function evaluateWebViewport(): void {
  const width = window.innerWidth;
  const height = currentViewportHeight();
  if (width !== baselineWidth || (!hasEditableFocus() && height !== baselineHeight)) {
    baselineWidth = width;
    baselineHeight = Math.max(height, window.innerHeight);
  }
  baselineHeight = Math.max(baselineHeight, height);
  const shrink = baselineHeight - height;
  publish(hasEditableFocus() && shrink > OPEN_THRESHOLD_PX, shrink);
}

function installNative(): void {
  void Keyboard.addListener('keyboardWillShow', (info: { keyboardHeight: number }) => publish(true, info.keyboardHeight));
  void Keyboard.addListener('keyboardDidShow', (info: { keyboardHeight: number }) => publish(true, info.keyboardHeight));
  void Keyboard.addListener('keyboardWillHide', () => publish(false, 0));
  void Keyboard.addListener('keyboardDidHide', () => publish(false, 0));
}

function installWeb(): void {
  const schedule = (): void => { window.requestAnimationFrame(evaluateWebViewport); };
  baselineWidth = window.innerWidth;
  baselineHeight = window.innerHeight;
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => window.setTimeout(schedule, 50));
}

export function installSoftKeyboardTracking(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  publish(false, 0);
  if (isNativeAppShell()) installNative();
  else installWeb();
}
