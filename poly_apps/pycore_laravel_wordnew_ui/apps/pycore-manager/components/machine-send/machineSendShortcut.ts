/** Key combination of the clipboard sync shortcut: parse, format and match (modifiers + one key). */

export const DEFAULT_SYNC_SHORTCUT = 'Alt+Shift+V';

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Control', 'Alt', 'Shift', 'Meta']);

export interface ShortcutEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** Layout independent label: letters and digits by physical key (Option+V does not type another character). */
function keyLabel(event: ShortcutEventLike): string {
  if (event.code.startsWith('Key')) return event.code.slice(3);
  if (event.code.startsWith('Digit')) return event.code.slice(5);
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

/** The combination of a key event ("Ctrl+Alt+K"), or null while only modifiers are held. */
export function formatShortcut(event: ShortcutEventLike): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(keyLabel(event));
  return parts.join('+');
}

/** A usable combination holds Ctrl, Alt or Meta, so it never collides with typing. */
export function isUsableShortcut(combo: string): boolean {
  return /(^|\+)(Ctrl|Alt|Meta)\+/.test(combo);
}

export function matchesShortcut(event: ShortcutEventLike, combo: string): boolean {
  return formatShortcut(event) === combo;
}
